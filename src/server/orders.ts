import 'server-only';
import { randomInt } from 'node:crypto';
import { db } from './db';
import { loadSettings } from './settings';
import { holdsSlot } from './slots';
import { ApiError } from './http-errors';
import { audit } from './audit';
import { notifyOrder } from './notify';
import { onlinePaymentsEnabled } from './payments';
import { computeBill, type CouponRule } from '@/lib/pricing';
import { BOOKING_DAYS, CITIES, PENDING_PAYMENT_MINUTES, SERVICEABLE_PINCODE_PREFIXES } from '@/config/lab';
import { bookableDates, fromDbDate, toDbDate } from '@/lib/ist';
import { isValidPincode } from '@/lib/phone';
import { statusIndex, type OrderDTO } from '@/lib/orders';
import type { Prisma } from '@/generated/prisma/client';
import type { Gender, PayMode } from '@/generated/prisma/enums';
import type { SessionUser } from './auth/session';

export interface CreateOrderInput {
  items: string[];
  coupon?: string | null;
  hardCopy: boolean;
  patient: { name: string; age: number; gender: Gender };
  address?: { line: string; pincode: string } | null;
  city: string;
  slot: { date: string; slotId: string };
  payMode: PayMode;
  /** What the browser showed. If the real total differs (a price changed), we refuse instead of charging more. */
  expectedTotal: number;
  idempotencyKey: string;
}

// No 0/O/1/I: codes get read over the phone.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => 'AL-' + Array.from({ length: 6 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('');

const orderInclude = { items: { select: { testId: true, name: true, price: true } }, report: { select: { id: true } } } satisfies Prisma.OrderInclude;
type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export function toOrderDTO(o: OrderRow): OrderDTO {
  return {
    id: o.id,
    code: o.code,
    status: o.status,
    payMode: o.payMode,
    paymentStatus: o.paymentStatus,
    items: o.items,
    slotDate: fromDbDate(o.slotDate),
    slotLabel: o.slotLabel,
    homeCollection: o.homeCollection,
    addressLine: o.addressLine,
    pincode: o.pincode,
    city: o.city,
    patientName: o.patientName,
    patientAge: o.patientAge,
    patientGender: o.patientGender,
    mrpTotal: o.mrpTotal,
    priceTotal: o.priceTotal,
    couponCode: o.couponCode,
    couponDiscount: o.couponDiscount,
    collectionFee: o.collectionFee,
    hardCopyFee: o.hardCopyFee,
    total: o.total,
    hardCopy: o.hardCopy,
    createdAt: o.createdAt.toISOString(),
    hasReport: !!o.report,
    cancellable: o.status === 'BOOKED' || o.status === 'PENDING_PAYMENT',
    holdExpiresAt: o.status === 'PENDING_PAYMENT' ? new Date(o.createdAt.getTime() + PENDING_PAYMENT_MINUTES * 60_000).toISOString() : null,
  };
}

async function resolveCoupon(code: string | null | undefined, price: number): Promise<{ rule: CouponRule | null; row: { code: string } | null }> {
  if (!code) return { rule: null, row: null };
  const now = new Date();
  const c = await db.coupon.findUnique({ where: { code: code.toUpperCase() } });
  const live = c && c.active && (!c.startsAt || c.startsAt <= now) && (!c.endsAt || c.endsAt > now) && (c.maxUses === null || c.usedCount < c.maxUses);
  if (!c || !live) throw new ApiError(400, 'coupon_invalid', 'That coupon is not valid any more.');
  if (price < c.minOrder) throw new ApiError(400, 'coupon_min_order', `${c.code} needs a basket of ₹${c.minOrder} or more.`);
  return { rule: { code: c.code, type: c.type, value: c.value, cap: c.cap, minOrder: c.minOrder }, row: { code: c.code } };
}

/**
 * Place an order. The server decides every number: tests and prices come from the database,
 * the coupon is checked here, the slot is checked against capacity under a lock. The browser's
 * idea of the total is only compared, never trusted.
 */
export async function createOrder(user: SessionUser, input: CreateOrderInput): Promise<OrderDTO> {
  // Same key twice (double click, retry after a flaky connection) returns the first order.
  const prior = await db.order.findUnique({ where: { userId_idempotencyKey: { userId: user.id, idempotencyKey: input.idempotencyKey } }, include: orderInclude });
  if (prior) return toOrderDTO(prior);

  const ids = [...new Set(input.items)];
  const tests = await db.test.findMany({ where: { id: { in: ids }, active: true } });
  if (tests.length !== ids.length) {
    const have = new Set(tests.map((t) => t.id));
    throw new ApiError(409, 'test_unavailable', `Some tests are no longer available: ${ids.filter((i) => !have.has(i)).join(', ')}. Please review your cart.`);
  }

  const settings = await loadSettings();
  const priceTotal = tests.reduce((s, t) => s + t.price, 0);
  const { rule, row: couponRow } = await resolveCoupon(input.coupon, priceTotal);
  const bill = computeBill({
    items: tests.map((t) => ({ id: t.id, price: t.price, mrp: t.mrp, centreVisit: t.centreVisit })),
    coupon: rule,
    hardCopy: input.hardCopy,
    fees: settings,
  });
  if (bill.total !== input.expectedTotal) {
    throw new ApiError(409, 'price_changed', 'Prices have changed since you added these tests. Please check your cart and try again.', { total: bill.total });
  }

  // Slot rules.
  if (!(CITIES as readonly string[]).includes(input.city)) throw new ApiError(400, 'invalid_input', 'Choose a city from the list.');
  if (!bookableDates(BOOKING_DAYS).includes(input.slot.date)) throw new ApiError(400, 'slot_date', 'Pick one of the dates offered.');
  const slot = await db.slot.findUnique({ where: { id: input.slot.slotId } });
  if (!slot || !slot.active) throw new ApiError(400, 'slot_invalid', 'That time slot is not available. Please pick another.');
  const needsMorning = tests.some((t) => t.fasting || t.morningSample);
  if (needsMorning && !slot.morning) throw new ApiError(400, 'slot_morning_only', 'These tests need a morning sample (after 10–12 hours of fasting). Please pick a morning slot.');

  // Address rules: only for home collection.
  if (bill.homeCollection) {
    const a = input.address;
    if (!a || a.line.trim().length < 8) throw new ApiError(400, 'invalid_input', 'Enter the full address for sample pickup.', { fields: { addr: 'Enter the full address for sample pickup.' } });
    const serviceable = isValidPincode(a.pincode) && SERVICEABLE_PINCODE_PREFIXES.some((p) => a.pincode.startsWith(p));
    if (!serviceable) throw new ApiError(400, 'invalid_input', 'We do not collect from that pincode yet.', { fields: { pin: 'Enter a 6-digit Karnataka pincode (starts with 5).' } });
  }

  const slotDate = toDbDate(input.slot.date);
  const online = input.payMode === 'ONLINE';
  if (online && !onlinePaymentsEnabled()) throw new ApiError(400, 'online_payment_off', 'Online payment is not available right now. Please choose pay at collection.');

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const created = await db.$transaction(async (tx) => {
        // One booking at a time per slot-day, so two people can't both take the last place.
        await tx.$queryRaw`SELECT 1 AS ok FROM (SELECT pg_advisory_xact_lock(hashtext(${`slot:${input.slot.date}:${slot.id}`}))) AS l`;
        const taken = await tx.order.count({ where: { slotDate, slotId: slot.id, AND: [holdsSlot()] } });
        if (taken >= slot.capacity) throw new ApiError(409, 'slot_full', 'That slot has just filled up. Please pick another time.');

        if (couponRow) {
          // Conditional increment: succeeds only while uses remain.
          const used = await tx.$executeRaw`UPDATE "Coupon" SET "usedCount" = "usedCount" + 1 WHERE "code" = ${couponRow.code} AND ("maxUses" IS NULL OR "usedCount" < "maxUses")`;
          if (used === 0) throw new ApiError(400, 'coupon_invalid', 'That coupon has just been used up.');
        }

        // Remember who the test is for and where, to prefill next time.
        let patient = await tx.patient.findFirst({ where: { userId: user.id, deletedAt: null, name: { equals: input.patient.name.trim(), mode: 'insensitive' }, age: input.patient.age, gender: input.patient.gender } });
        patient ??= await tx.patient.create({ data: { userId: user.id, name: input.patient.name.trim(), age: input.patient.age, gender: input.patient.gender, isSelf: input.patient.name.trim().toLowerCase() === user.name.trim().toLowerCase() } });
        let addressId: string | null = null;
        if (bill.homeCollection && input.address) {
          const line = input.address.line.trim();
          let addr = await tx.address.findFirst({ where: { userId: user.id, deletedAt: null, line: { equals: line, mode: 'insensitive' }, pincode: input.address.pincode } });
          addr ??= await tx.address.create({ data: { userId: user.id, line, pincode: input.address.pincode, city: input.city } });
          addressId = addr.id;
        }

        const order = await tx.order.create({
          data: {
            code: newCode(),
            userId: user.id,
            patientId: patient.id,
            addressId,
            patientName: patient.name,
            patientAge: patient.age,
            patientGender: patient.gender,
            homeCollection: bill.homeCollection,
            addressLine: bill.homeCollection ? input.address!.line.trim() : null,
            pincode: bill.homeCollection ? input.address!.pincode : null,
            city: input.city,
            slotDate,
            slotId: slot.id,
            slotLabel: slot.label,
            status: online ? 'PENDING_PAYMENT' : 'BOOKED',
            payMode: input.payMode,
            paymentStatus: online ? 'PENDING' : 'UNPAID',
            hardCopy: input.hardCopy,
            couponCode: couponRow?.code ?? null,
            mrpTotal: bill.mrpTotal,
            priceTotal: bill.priceTotal,
            couponDiscount: bill.couponDiscount,
            collectionFee: bill.collectionFee,
            hardCopyFee: bill.hardCopyFee,
            total: bill.total,
            idempotencyKey: input.idempotencyKey,
            items: { create: tests.map((t) => ({ testId: t.id, name: t.name, price: t.price, mrp: t.mrp })) },
          },
          include: orderInclude,
        });
        await audit(tx, { actorId: user.id, action: 'order.create', entity: 'Order', entityId: order.id, meta: { code: order.code, payMode: order.payMode, total: order.total } });
        return order;
      });
      if (!online) await notifyOrder(created.id, 'booking_confirmed'); // online orders are confirmed when payment lands
      return toOrderDTO(created);
    } catch (e) {
      // Order-code collision (1 in ~10^9): pick another code. Same idempotency key raced: return the winner.
      if (typeof e === 'object' && e && 'code' in e && e.code === 'P2002') {
        const meta = JSON.stringify((e as { meta?: unknown }).meta ?? '');
        if (meta.includes('idempotencyKey') || meta.includes('userId')) {
          const winner = await db.order.findUnique({ where: { userId_idempotencyKey: { userId: user.id, idempotencyKey: input.idempotencyKey } }, include: orderInclude });
          if (winner) return toOrderDTO(winner);
        }
        continue;
      }
      throw e;
    }
  }
  throw new ApiError(500, 'server_error', 'Could not create the order. Please try again.');
}

export async function listOrders(userId: string): Promise<OrderDTO[]> {
  const rows = await db.order.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, include: orderInclude, take: 100 });
  return rows.map(toOrderDTO);
}

/** One order, only if it is yours (or you are staff). Anything else looks like "not found". */
export async function getOrderFor(user: SessionUser, code: string): Promise<OrderDTO> {
  const row = await db.order.findUnique({ where: { code }, include: orderInclude });
  if (!row || (row.userId !== user.id && user.role === 'PATIENT')) throw new ApiError(404, 'not_found', 'We could not find that order.');
  return toOrderDTO(row);
}

/** Cancel before the sample is collected. Frees the slot. */
export async function cancelOrder(user: SessionUser, code: string): Promise<OrderDTO> {
  const row = await db.order.findUnique({ where: { code }, include: orderInclude });
  if (!row || row.userId !== user.id) throw new ApiError(404, 'not_found', 'We could not find that order.');
  if (row.status !== 'BOOKED' && row.status !== 'PENDING_PAYMENT') throw new ApiError(409, 'not_cancellable', 'This order can no longer be cancelled online. Please call us.');
  const updated = await db.$transaction(async (tx) => {
    // Conditional so a sample collected a moment ago wins over the cancel.
    const r = await tx.order.updateMany({ where: { id: row.id, status: { in: ['BOOKED', 'PENDING_PAYMENT'] } }, data: { status: 'CANCELLED', cancelledAt: new Date(), paymentStatus: row.paymentStatus === 'PAID' ? 'PAID' : 'FAILED' } });
    if (r.count === 0) throw new ApiError(409, 'not_cancellable', 'This order can no longer be cancelled online. Please call us.');
    if (row.couponCode) await tx.$executeRaw`UPDATE "Coupon" SET "usedCount" = GREATEST("usedCount" - 1, 0) WHERE "code" = ${row.couponCode}`;
    await audit(tx, { actorId: user.id, action: 'order.cancel', entity: 'Order', entityId: row.id, meta: { code: row.code } });
    return tx.order.findUniqueOrThrow({ where: { id: row.id }, include: orderInclude });
  });
  return toOrderDTO(updated);
}

export { statusIndex };

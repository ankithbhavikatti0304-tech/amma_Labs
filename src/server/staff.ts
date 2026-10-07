import 'server-only';
import { db } from './db';
import { audit } from './audit';
import { ApiError } from './http-errors';
import { toDbDate, fromDbDate } from '@/lib/ist';
import type { Prisma } from '@/generated/prisma/client';
import type { OrderStatus } from '@/generated/prisma/enums';
import type { SessionUser } from './auth/session';

export interface PickupDTO {
  code: string;
  status: OrderStatus;
  slotLabel: string;
  patientName: string;
  patientAge: number;
  phone: string;
  address: string | null;
  tests: string[];
  /** What to collect in cash/UPI, if pay-at-collection and unpaid. */
  amountDue: number;
  assignedTo: string | null;
  mine: boolean;
}

/** A phlebotomist's day: their assigned pickups plus unassigned ones. Admins see every pickup. */
export async function listPickups(user: SessionUser, date: string): Promise<PickupDTO[]> {
  const where: Prisma.OrderWhereInput = {
    slotDate: toDbDate(date),
    homeCollection: true,
    status: { in: ['BOOKED', 'SAMPLE_COLLECTED'] },
    ...(user.role === 'PHLEBOTOMIST' ? { OR: [{ assignedToId: user.id }, { assignedToId: null }] } : {}),
  };
  const rows = await db.order.findMany({
    where,
    orderBy: [{ slot: { startMinutes: 'asc' } }, { createdAt: 'asc' }],
    include: { user: { select: { phone: true } }, items: { select: { name: true } }, assignedTo: { select: { name: true } } },
  });
  return rows.map((o) => ({
    code: o.code,
    status: o.status,
    slotLabel: o.slotLabel,
    patientName: o.patientName,
    patientAge: o.patientAge,
    phone: o.user.phone,
    address: o.addressLine ? `${o.addressLine}, ${o.city} ${o.pincode ?? ''}`.trim() : null,
    tests: o.items.map((i) => i.name),
    amountDue: o.payMode === 'COD' && o.paymentStatus === 'UNPAID' ? o.total : 0,
    assignedTo: o.assignedTo?.name ?? null,
    mine: o.assignedToId === user.id,
  }));
}

export interface QueueRow {
  code: string;
  status: OrderStatus;
  patientName: string;
  tests: string[];
  slotDate: string;
  entered: number;
  expected: number;
}

/** Orders waiting on the lab: sample collected or processing, with how many results are in. */
export async function listLabQueue(statuses: OrderStatus[]): Promise<QueueRow[]> {
  const orders = await db.order.findMany({
    where: { status: { in: statuses } },
    orderBy: { createdAt: 'asc' },
    take: 200,
    include: { items: { select: { name: true, testId: true } } },
  });
  if (!orders.length) return [];
  const ids = orders.map((o) => o.id);
  const [entered, expected] = await Promise.all([
    db.result.groupBy({ by: ['orderId'], where: { orderId: { in: ids } }, _count: { _all: true } }),
    db.$queryRaw<{ orderId: string; n: number }[]>`
      SELECT oi."orderId" AS "orderId", COUNT(DISTINCT tp."parameterId")::int AS n
      FROM "OrderItem" oi JOIN "TestParameter" tp ON tp."testId" = oi."testId"
      WHERE oi."orderId" = ANY(${ids}) GROUP BY oi."orderId"`,
  ]);
  const e = new Map(entered.map((x) => [x.orderId, x._count._all]));
  const x = new Map(expected.map((r) => [r.orderId, r.n]));
  return orders.map((o) => ({
    code: o.code,
    status: o.status,
    patientName: o.patientName,
    tests: o.items.map((i) => i.name),
    slotDate: fromDbDate(o.slotDate),
    entered: e.get(o.id) ?? 0,
    expected: x.get(o.id) ?? 0,
  }));
}

export async function assignPhlebotomist(admin: SessionUser, code: string, phlebotomistId: string | null): Promise<void> {
  const order = await db.order.findUnique({ where: { code } });
  if (!order) throw new ApiError(404, 'not_found', 'Order not found.');
  if (order.status !== 'BOOKED') throw new ApiError(409, 'wrong_state', 'Only a booked order can be reassigned.');
  if (phlebotomistId) {
    const p = await db.user.findUnique({ where: { id: phlebotomistId } });
    if (!p || !p.active || p.role !== 'PHLEBOTOMIST') throw new ApiError(400, 'invalid_input', 'Choose an active phlebotomist.');
  }
  await db.order.update({ where: { id: order.id }, data: { assignedToId: phlebotomistId } });
  await audit(null, { actorId: admin.id, action: 'order.assign', entity: 'Order', entityId: order.id, meta: { code, to: phlebotomistId } });
}

/** Admin cancels an order that has not been reported yet (e.g. patient unreachable). Releases the slot and the coupon use. */
export async function adminCancel(admin: SessionUser, code: string, reason: string): Promise<void> {
  const order = await db.order.findUnique({ where: { code } });
  if (!order) throw new ApiError(404, 'not_found', 'Order not found.');
  if (order.status === 'CANCELLED' || order.status === 'REPORT_READY') throw new ApiError(409, 'wrong_state', 'This order can no longer be cancelled.');
  await db.$transaction(async (tx) => {
    await tx.order.update({ where: { id: order.id }, data: { status: 'CANCELLED', cancelledAt: new Date(), paymentStatus: order.paymentStatus === 'PAID' ? 'PAID' : 'FAILED' } });
    if (order.couponCode) await tx.$executeRaw`UPDATE "Coupon" SET "usedCount" = GREATEST("usedCount" - 1, 0) WHERE "code" = ${order.couponCode}`;
    await audit(tx, { actorId: admin.id, action: 'order.cancel', entity: 'Order', entityId: order.id, meta: { code, reason: reason.slice(0, 200), by: 'admin' } });
  });
}

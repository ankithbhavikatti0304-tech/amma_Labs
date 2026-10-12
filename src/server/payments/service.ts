import 'server-only';
import { db } from '../db';
import { audit } from '../audit';
import { ApiError } from '../http-errors';
import { log } from '../log';
import { payments } from './index';
import { notifyOrder } from '../notify';
import { PENDING_PAYMENT_MINUTES } from '@/config/lab';
import type { SessionUser } from '../auth/session';

const holdCutoff = () => new Date(Date.now() - PENDING_PAYMENT_MINUTES * 60_000);

export interface PaymentInit {
  provider: 'razorpay' | 'mock';
  keyId?: string;
  providerOrderId: string;
  /** Paise. */
  amount: number;
  currency: 'INR';
  devSignature?: string;
  /** When the slot hold runs out. */
  expiresAt: string;
}

/**
 * Start (or resume) payment for the person's own pending online order. The amount always
 * comes from the order in our database, never from the browser.
 */
export async function initPayment(user: SessionUser, code: string): Promise<PaymentInit> {
  const order = await db.order.findUnique({ where: { code } });
  if (!order || order.userId !== user.id) throw new ApiError(404, 'not_found', 'We could not find that order.');
  if (order.payMode !== 'ONLINE' || order.status !== 'PENDING_PAYMENT') {
    throw new ApiError(409, 'not_payable', order.paymentStatus === 'PAID' ? 'This order is already paid.' : 'This order is not waiting for payment.');
  }
  if (order.createdAt < holdCutoff()) {
    await expireOrder(order.id);
    throw new ApiError(409, 'expired', 'Your slot was held for 15 minutes and that time is up. Please book again.');
  }
  const expiresAt = new Date(order.createdAt.getTime() + PENDING_PAYMENT_MINUTES * 60_000).toISOString();
  const p = payments();
  const amount = order.total * 100;

  // Resume an open attempt instead of creating a second gateway order.
  const open = await db.payment.findFirst({ where: { orderId: order.id, status: 'PENDING', provider: p.name }, orderBy: { createdAt: 'desc' } });
  if (open) return { provider: p.name, providerOrderId: open.providerOrderId, amount, currency: 'INR', expiresAt, ...p.publicInfo(open.providerOrderId) };

  const g = await p.createOrder({ amountPaise: amount, receipt: order.code }).catch((e) => {
    log.error('gateway order failed', { err: e });
    throw new ApiError(502, 'gateway', "We couldn't reach the payment gateway. Please try again in a moment.");
  });
  await db.payment.create({ data: { orderId: order.id, provider: p.name, providerOrderId: g.providerOrderId, amount } });
  return { provider: p.name, keyId: g.keyId, providerOrderId: g.providerOrderId, amount, currency: 'INR', devSignature: g.devSignature, expiresAt };
}

/** Mark a payment received and confirm the booking. Safe to call twice, from the browser and the webhook. */
export async function markPaid(args: { providerOrderId: string; paymentId: string; amountPaise?: number; source: 'checkout' | 'webhook' }): Promise<{ orderCode: string; confirmed: boolean }> {
  const pay = await db.payment.findUnique({ where: { providerOrderId: args.providerOrderId }, include: { order: true } });
  if (!pay) throw new ApiError(404, 'not_found', 'Unknown payment.');
  const order = pay.order;
  // If the gateway says a different amount was paid, do not confirm: someone needs to look.
  if (args.amountPaise !== undefined && args.amountPaise !== pay.amount) {
    log.error('payment amount mismatch', { orderId: order.id, expected: pay.amount, got: args.amountPaise });
    await audit(null, { action: 'payment.mismatch', entity: 'Order', entityId: order.id, meta: { expected: pay.amount, got: args.amountPaise } });
    throw new ApiError(409, 'amount_mismatch', 'The amount paid does not match the order. Please call us.');
  }
  if (pay.status === 'PAID') return { orderCode: order.code, confirmed: order.status !== 'CANCELLED' };

  const confirmed = await db.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({ where: { id: pay.id, status: { not: 'PAID' } }, data: { status: 'PAID', providerPaymentId: args.paymentId } });
    if (claimed.count === 0) return order.status !== 'CANCELLED'; // someone else got there first
    const moved = await tx.order.updateMany({ where: { id: order.id, status: 'PENDING_PAYMENT' }, data: { status: 'BOOKED', paymentStatus: 'PAID' } });
    if (moved.count === 1) {
      await audit(tx, { action: 'payment.paid', entity: 'Order', entityId: order.id, meta: { code: order.code, via: args.source } });
      return true;
    }
    // Money arrived for an order that had already lapsed or been cancelled. Keep the money on record so staff can refund it.
    await tx.order.update({ where: { id: order.id }, data: { paymentStatus: 'PAID' } });
    await audit(tx, { action: 'payment.late', entity: 'Order', entityId: order.id, meta: { code: order.code, status: order.status } });
    return false;
  });
  if (confirmed) await notifyBooked(order.id);
  return { orderCode: order.code, confirmed };
}

export async function confirmCheckout(user: SessionUser, code: string, input: { providerOrderId: string; paymentId: string; signature: string }) {
  const pay = await db.payment.findUnique({ where: { providerOrderId: input.providerOrderId }, include: { order: { select: { userId: true, code: true } } } });
  // Same answer whether the payment is unknown or someone else's.
  if (!pay || pay.order.userId !== user.id || pay.order.code !== code) throw new ApiError(404, 'not_found', 'We could not find that payment.');
  if (!payments().verifyCheckout(input)) {
    await audit(null, { actorId: user.id, action: 'payment.bad_signature', entity: 'Order', entityId: pay.orderId });
    throw new ApiError(400, 'bad_signature', "We couldn't verify that payment. If money was taken, call us and we'll sort it out.");
  }
  return markPaid({ providerOrderId: input.providerOrderId, paymentId: input.paymentId, source: 'checkout' });
}

interface RazorpayEvent {
  event: string;
  payload?: { payment?: { entity?: { id: string; order_id: string; amount: number; status: string } }; order?: { entity?: { id: string; amount_paid?: number } } };
}

/** Gateway → us. Verified by signature, and each event is handled once. */
export async function handleWebhook(raw: string, signature: string, eventId: string | null): Promise<{ handled: boolean }> {
  if (!payments().verifyWebhook(raw, signature)) throw new ApiError(401, 'bad_signature', 'Invalid signature.');
  let ev: RazorpayEvent;
  try { ev = JSON.parse(raw); } catch { throw new ApiError(400, 'bad_json', 'Invalid body.'); }

  if (eventId) {
    try { await db.webhookEvent.create({ data: { id: eventId, provider: payments().name } }); }
    catch (e) { if (typeof e === 'object' && e && 'code' in e && e.code === 'P2002') return { handled: false }; throw e; }
  }
  const pay = ev.payload?.payment?.entity;
  if ((ev.event === 'payment.captured' || ev.event === 'order.paid') && pay) {
    try {
      await markPaid({ providerOrderId: pay.order_id, paymentId: pay.id, amountPaise: pay.amount, source: 'webhook' });
    } catch (e) {
      // Let the gateway retry transient failures, but not our own refusals (mismatch / unknown).
      if (e instanceof ApiError) { log.warn('webhook not applied', { code: e.code }); return { handled: false }; }
      if (eventId) await db.webhookEvent.delete({ where: { id: eventId } }).catch(() => undefined);
      throw e;
    }
    return { handled: true };
  }
  if (ev.event === 'payment.failed' && pay) {
    await db.payment.updateMany({ where: { providerOrderId: pay.order_id, status: 'PENDING' }, data: { status: 'FAILED' } });
    return { handled: true };
  }
  return { handled: false };
}

/** Cancel an unpaid online order whose hold has run out. Releases its coupon use. */
export async function expireOrder(orderId: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const o = await tx.order.findUnique({ where: { id: orderId } });
    if (!o || o.status !== 'PENDING_PAYMENT') return false;
    const r = await tx.order.updateMany({ where: { id: orderId, status: 'PENDING_PAYMENT' }, data: { status: 'CANCELLED', cancelledAt: new Date(), paymentStatus: 'FAILED' } });
    if (r.count === 0) return false;
    if (o.couponCode) await tx.$executeRaw`UPDATE "Coupon" SET "usedCount" = GREATEST("usedCount" - 1, 0) WHERE "code" = ${o.couponCode}`;
    await tx.payment.updateMany({ where: { orderId, status: 'PENDING' }, data: { status: 'FAILED' } });
    await audit(tx, { action: 'order.expire', entity: 'Order', entityId: orderId, meta: { code: o.code } });
    return true;
  });
}

export async function expireStaleOrders(): Promise<number> {
  const stale = await db.order.findMany({ where: { status: 'PENDING_PAYMENT', createdAt: { lt: holdCutoff() } }, select: { id: true }, take: 200 });
  let n = 0;
  for (const o of stale) if (await expireOrder(o.id)) n++;
  return n;
}

const notifyBooked = (orderId: string) => notifyOrder(orderId, 'booking_confirmed');

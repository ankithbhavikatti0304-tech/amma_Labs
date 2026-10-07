import 'server-only';
import { db } from './db';
import { audit } from './audit';
import { ApiError } from './http-errors';
import type { SessionUser } from './auth/session';

/**
 * A phlebotomist marks the sample collected. The barcode is whatever the tube sticker says
 * (typed or scanned); if left blank we generate one. For pay-at-collection orders they can
 * also record that the money was taken.
 */
export async function collectSample(user: SessionUser, code: string, opts: { barcode?: string; paymentCollected?: boolean } = {}): Promise<{ barcode: string }> {
  const order = await db.order.findUnique({ where: { code } });
  if (!order) throw new ApiError(404, 'not_found', 'Order not found.');
  if (order.status !== 'BOOKED') {
    throw new ApiError(409, 'wrong_state', order.status === 'PENDING_PAYMENT' ? 'This order is waiting for online payment.' : order.status === 'CANCELLED' ? 'This order was cancelled.' : 'The sample for this order is already collected.');
  }
  // A phlebotomist works their own assigned pickups; admins can do any.
  if (user.role === 'PHLEBOTOMIST' && order.assignedToId && order.assignedToId !== user.id) throw new ApiError(403, 'forbidden', 'This pickup is assigned to someone else.');

  const barcode = opts.barcode?.trim();
  if (barcode && !/^[A-Za-z0-9-]{4,40}$/.test(barcode)) throw new ApiError(400, 'invalid_barcode', 'The barcode should be 4–40 letters, numbers or dashes.');

  return db.$transaction(async (tx) => {
    const moved = await tx.order.updateMany({ where: { id: order.id, status: 'BOOKED' }, data: { status: 'SAMPLE_COLLECTED', ...(opts.paymentCollected && order.payMode === 'COD' ? { paymentStatus: 'PAID' as const } : {}) } });
    if (moved.count === 0) throw new ApiError(409, 'wrong_state', 'The sample for this order is already collected.');
    const n = (await tx.sample.count({ where: { orderId: order.id } })) + 1;
    const final = barcode ?? `S-${order.code}-${n}`;
    try {
      await tx.sample.create({ data: { orderId: order.id, barcode: final, phlebotomistId: user.id } });
    } catch (e) {
      if (typeof e === 'object' && e && 'code' in e && e.code === 'P2002') throw new ApiError(409, 'barcode_used', 'That barcode is already used on another sample.');
      throw e;
    }
    await audit(tx, { actorId: user.id, action: 'sample.collect', entity: 'Order', entityId: order.id, meta: { code: order.code, paymentCollected: !!opts.paymentCollected } });
    return { barcode: final };
  });
}

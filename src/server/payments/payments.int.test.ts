import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../../test/db';
import { db } from '../db';
import { createOrder, type CreateOrderInput } from '../orders';
import { confirmCheckout, expireStaleOrders, handleWebhook, initPayment, markPaid } from './service';
import { payments, mockWebhookSignature } from './index';
import { retryNotifications } from '../notify';
import { resetEnvCache } from '../env';
import { bookableDates } from '@/lib/ist';
import type { SessionUser } from '../auth/session';

let me: SessionUser;
let other: SessionUser;

const order = (over: Partial<CreateOrderInput> = {}): CreateOrderInput => ({
  items: ['thyt'], coupon: null, hardCopy: false, patient: { name: 'Lakshmi Rao', age: 34, gender: 'FEMALE' },
  address: { line: '12, 4th Cross, Indiranagar', pincode: '560038' }, city: 'Bengaluru', slot: { date: bookableDates(5)[0]!, slotId: 's1000' },
  payMode: 'ONLINE', expectedTotal: 539, idempotencyKey: crypto.randomUUID(), ...over,
});

/** What the gateway's payment.captured webhook looks like. */
const captured = (providerOrderId: string, amount: number, paymentId = 'pay_w1') =>
  JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: paymentId, order_id: providerOrderId, amount, status: 'captured' } } } });
const hook = (raw: string, eventId: string | null, sig = mockWebhookSignature(raw)) => handleWebhook(raw, sig, eventId);

beforeEach(async () => {
  await resetDb();
  const a = await db.user.create({ data: { phone: '9876500001', name: 'Lakshmi Rao' } });
  const b = await db.user.create({ data: { phone: '9876500002', name: 'Someone Else' } });
  me = { id: a.id, name: a.name, phone: a.phone, role: 'PATIENT' };
  other = { id: b.id, name: b.name, phone: b.phone, role: 'PATIENT' };
});

describe('online payment switched off (PAYMENT_PROVIDER=none)', () => {
  it('refuses an online order with a clear message and still takes a cash order', async () => {
    const prev = process.env.PAYMENT_PROVIDER;
    process.env.PAYMENT_PROVIDER = 'none';
    resetEnvCache();
    try {
      await expect(createOrder(me, order())).rejects.toMatchObject({ status: 400, code: 'online_payment_off' });
      expect(await db.order.count()).toBe(0);
      await expect(handleWebhook('{}', 'x', null)).rejects.toMatchObject({ code: 'online_payment_off' });
      const cod = await createOrder(me, order({ payMode: 'COD', idempotencyKey: crypto.randomUUID() }));
      expect(cod).toMatchObject({ status: 'BOOKED' });
    } finally {
      if (prev === undefined) delete process.env.PAYMENT_PROVIDER; else process.env.PAYMENT_PROVIDER = prev;
      resetEnvCache();
    }
  });
});

describe('starting a payment', () => {
  it('asks the gateway for exactly the order total, in paise, and resumes rather than duplicating', async () => {
    const o = await createOrder(me, order());
    const a = await initPayment(me, o.code);
    expect(a).toMatchObject({ provider: 'mock', amount: 539 * 100, currency: 'INR' });
    expect(await db.payment.count()).toBe(1);
    const b = await initPayment(me, o.code);
    expect(b.providerOrderId).toBe(a.providerOrderId);
    expect(await db.payment.count()).toBe(1);
  });

  it("refuses someone else's order, a cash order, and a paid order", async () => {
    const o = await createOrder(me, order());
    await expect(initPayment(other, o.code)).rejects.toMatchObject({ status: 404 });
    const cod = await createOrder(me, order({ payMode: 'COD', idempotencyKey: crypto.randomUUID(), slot: { date: bookableDates(5)[1]!, slotId: 's1000' } }));
    await expect(initPayment(me, cod.code)).rejects.toMatchObject({ code: 'not_payable' });
  });

  it('after the 15-minute hold, cancels the order, frees the coupon and says so', async () => {
    const o = await createOrder(me, order({ items: ['thyt', 'vitd'], coupon: 'AMMA10', expectedTotal: 1294 }));
    expect((await db.coupon.findUniqueOrThrow({ where: { code: 'AMMA10' } })).usedCount).toBe(1);
    await db.order.update({ where: { code: o.code }, data: { createdAt: new Date(Date.now() - 16 * 60_000) } });
    await expect(initPayment(me, o.code)).rejects.toMatchObject({ status: 409, code: 'expired' });
    expect(await db.order.findUniqueOrThrow({ where: { code: o.code } })).toMatchObject({ status: 'CANCELLED', paymentStatus: 'FAILED' });
    expect((await db.coupon.findUniqueOrThrow({ where: { code: 'AMMA10' } })).usedCount).toBe(0);
  });
});

describe('browser confirmation (the signature the checkout hands back)', () => {
  async function started() {
    const o = await createOrder(me, order());
    const init = await initPayment(me, o.code);
    const paymentId = `pay_${init.providerOrderId.slice(5)}`;
    return { o, init, good: { providerOrderId: init.providerOrderId, paymentId, signature: init.devSignature! } };
  }

  it('a valid signature confirms the booking and marks it paid', async () => {
    const { o, good } = await started();
    await expect(confirmCheckout(me, o.code, good)).resolves.toMatchObject({ confirmed: true });
    expect(await db.order.findUniqueOrThrow({ where: { code: o.code } })).toMatchObject({ status: 'BOOKED', paymentStatus: 'PAID' });
    expect((await db.payment.findFirstOrThrow()).status).toBe('PAID');
  });

  it('is safe to call twice (double click, retry) and still one booking, one audit entry', async () => {
    const { o, good } = await started();
    await Promise.all([confirmCheckout(me, o.code, good), confirmCheckout(me, o.code, good)]);
    await confirmCheckout(me, o.code, good);
    expect(await db.auditLog.count({ where: { action: 'payment.paid' } })).toBe(1);
  });

  it('a forged signature changes nothing and is recorded', async () => {
    const { o, good } = await started();
    await expect(confirmCheckout(me, o.code, { ...good, signature: 'f'.repeat(64) })).rejects.toMatchObject({ code: 'bad_signature' });
    expect(await db.order.findUniqueOrThrow({ where: { code: o.code } })).toMatchObject({ status: 'PENDING_PAYMENT', paymentStatus: 'PENDING' });
    expect(await db.auditLog.count({ where: { action: 'payment.bad_signature' } })).toBe(1);
  });

  it("cannot confirm another person's payment, or pair a payment with a different order", async () => {
    const { o, good } = await started();
    await expect(confirmCheckout(other, o.code, good)).rejects.toMatchObject({ status: 404 });
    const second = await createOrder(me, order({ idempotencyKey: crypto.randomUUID(), slot: { date: bookableDates(5)[2]!, slotId: 's1000' } }));
    await expect(confirmCheckout(me, second.code, good)).rejects.toMatchObject({ status: 404 });
  });
});

describe('webhooks (the gateway telling us, even if the browser never came back)', () => {
  async function started() {
    const o = await createOrder(me, order());
    const init = await initPayment(me, o.code);
    return { o, init };
  }

  it('confirms the booking from the webhook alone', async () => {
    const { o, init } = await started();
    expect(await hook(captured(init.providerOrderId, 53900), 'evt_1')).toEqual({ handled: true });
    expect(await db.order.findUniqueOrThrow({ where: { code: o.code } })).toMatchObject({ status: 'BOOKED', paymentStatus: 'PAID' });
  });

  it('a replayed event does nothing the second time', async () => {
    const { init } = await started();
    const raw = captured(init.providerOrderId, 53900);
    expect(await hook(raw, 'evt_same')).toEqual({ handled: true });
    expect(await hook(raw, 'evt_same')).toEqual({ handled: false });
    expect(await db.auditLog.count({ where: { action: 'payment.paid' } })).toBe(1);
  });

  it('rejects a bad signature outright, and a body altered after signing', async () => {
    const { o, init } = await started();
    const raw = captured(init.providerOrderId, 53900);
    await expect(handleWebhook(raw, 'deadbeef', 'evt_x')).rejects.toMatchObject({ status: 401 });
    await expect(handleWebhook(raw.replace('53900', '100'), mockWebhookSignature(raw), 'evt_y')).rejects.toMatchObject({ status: 401 });
    expect((await db.order.findUniqueOrThrow({ where: { code: o.code } })).status).toBe('PENDING_PAYMENT');
  });

  it('does not confirm when the amount paid is not the amount due', async () => {
    const { o, init } = await started();
    expect(await hook(captured(init.providerOrderId, 100), 'evt_short')).toEqual({ handled: false });
    expect((await db.order.findUniqueOrThrow({ where: { code: o.code } })).status).toBe('PENDING_PAYMENT');
    expect(await db.auditLog.count({ where: { action: 'payment.mismatch' } })).toBe(1);
  });

  it('records money that arrives after the order lapsed, so staff can refund it', async () => {
    const { o, init } = await started();
    await db.order.update({ where: { code: o.code }, data: { createdAt: new Date(Date.now() - 20 * 60_000) } });
    expect(await expireStaleOrders()).toBe(1);
    await hook(captured(init.providerOrderId, 53900), 'evt_late');
    expect(await db.order.findUniqueOrThrow({ where: { code: o.code } })).toMatchObject({ status: 'CANCELLED', paymentStatus: 'PAID' }); // paid + cancelled = refund needed
    expect(await db.auditLog.count({ where: { action: 'payment.late' } })).toBe(1);
  });

  it('a failed payment leaves the order open for another try', async () => {
    const { o, init } = await started();
    const raw = JSON.stringify({ event: 'payment.failed', payload: { payment: { entity: { id: 'pay_f', order_id: init.providerOrderId, amount: 53900, status: 'failed' } } } });
    await hook(raw, 'evt_fail');
    expect((await db.order.findUniqueOrThrow({ where: { code: o.code } })).status).toBe('PENDING_PAYMENT');
    const again = await initPayment(me, o.code);
    expect(again.providerOrderId).not.toBe(init.providerOrderId); // a new gateway order for the retry
  });

  it('ignores events it does not handle, and unknown payments do not crash it', async () => {
    expect(await hook(JSON.stringify({ event: 'refund.created', payload: {} }), 'evt_r')).toEqual({ handled: false });
    expect(await hook(captured('order_nobody', 100), 'evt_u')).toEqual({ handled: false });
    await expect(markPaid({ providerOrderId: 'nope', paymentId: 'p', source: 'checkout' })).rejects.toMatchObject({ status: 404 });
  });
});

describe('maintenance and notifications', () => {
  it('expires only the stale unpaid orders', async () => {
    const stale = await createOrder(me, order());
    const fresh = await createOrder(other, order({ idempotencyKey: crypto.randomUUID() }));
    const cod = await createOrder(me, order({ payMode: 'COD', idempotencyKey: crypto.randomUUID(), slot: { date: bookableDates(5)[3]!, slotId: 's1000' } }));
    await db.order.updateMany({ where: { code: { in: [stale.code, cod.code] } }, data: { createdAt: new Date(Date.now() - 60 * 60_000) } });
    expect(await expireStaleOrders()).toBe(1);
    const status = async (c: string) => (await db.order.findUniqueOrThrow({ where: { code: c } })).status;
    expect([await status(stale.code), await status(fresh.code), await status(cod.code)]).toEqual(['CANCELLED', 'PENDING_PAYMENT', 'BOOKED']);
  });

  it('queues a booking message for a cash order at once, and for an online order only once paid', async () => {
    await createOrder(me, order({ payMode: 'COD', slot: { date: bookableDates(5)[1]!, slotId: 's1000' } }));
    expect(await db.notification.count({ where: { template: 'booking_confirmed' } })).toBe(1);
    const o = await createOrder(me, order());
    expect(await db.notification.count({ where: { template: 'booking_confirmed' } })).toBe(1); // unchanged: not confirmed yet
    const init = await initPayment(me, o.code);
    await confirmCheckout(me, o.code, { providerOrderId: init.providerOrderId, paymentId: `pay_${init.providerOrderId.slice(5)}`, signature: init.devSignature! });
    expect(await db.notification.count({ where: { template: 'booking_confirmed' } })).toBe(2);
  });

  it('messages carry the order code and link, never a result value or a name', async () => {
    const o = await createOrder(me, order({ payMode: 'COD' }));
    const n = await db.notification.findFirstOrThrow();
    expect(Object.keys(n.variables as object).sort()).toEqual(['code', 'slot', 'url']);
    expect(JSON.stringify(n.variables)).toContain(o.code);
    expect(JSON.stringify(n.variables)).not.toContain('Lakshmi');
  });

  it('retries messages that failed, and a failure never breaks the order', async () => {
    await createOrder(me, order({ payMode: 'COD' }));
    await db.notification.updateMany({ data: { status: 'FAILED', attempts: 1, lastError: 'gateway 500' } });
    expect(await retryNotifications()).toBe(1);
    expect(await db.notification.findFirstOrThrow()).toMatchObject({ status: 'SENT', attempts: 2, lastError: null });
  });

  it('the mock gateway is what runs in tests', () => {
    expect(payments().name).toBe('mock');
  });
});

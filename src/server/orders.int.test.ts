import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../test/db';
import { db } from './db';
import { cancelOrder, createOrder, getOrderFor, listOrders, type CreateOrderInput } from './orders';
import { listSlotDays } from './slots';
import { bookableDates } from '@/lib/ist';
import type { SessionUser } from './auth/session';

let me: SessionUser;
let other: SessionUser;

const tomorrow = () => bookableDates(5)[0]!;
const base = (over: Partial<CreateOrderInput> = {}): CreateOrderInput => ({
  items: ['cbc'], // ₹299, no fasting, home collection → +₹99 fee under ₹499
  coupon: null,
  hardCopy: false,
  patient: { name: 'Lakshmi Rao', age: 34, gender: 'FEMALE' },
  address: { line: '12, 4th Cross, Indiranagar', pincode: '560038' },
  city: 'Bengaluru',
  slot: { date: tomorrow(), slotId: 's1000' },
  payMode: 'COD',
  expectedTotal: 299 + 99,
  idempotencyKey: crypto.randomUUID(),
  ...over,
});

beforeEach(async () => {
  await resetDb();
  const a = await db.user.create({ data: { phone: '9876543210', name: 'Lakshmi Rao' } });
  const b = await db.user.create({ data: { phone: '9876543211', name: 'Someone Else' } });
  me = { id: a.id, name: a.name, phone: a.phone, role: 'PATIENT' };
  other = { id: b.id, name: b.name, phone: b.phone, role: 'PATIENT' };
});

describe('createOrder: pricing is decided by the server', () => {
  it('creates a COD order as BOOKED with the right bill', async () => {
    const o = await createOrder(me, base());
    expect(o).toMatchObject({ status: 'BOOKED', payMode: 'COD', paymentStatus: 'UNPAID', priceTotal: 299, collectionFee: 99, total: 398, homeCollection: true });
    expect(o.code).toMatch(/^AL-[A-HJ-NP-Z2-9]{6}$/);
    expect(o.items).toEqual([{ testId: 'cbc', name: 'Complete Blood Count (CBC)', price: 299 }]);
  });

  it('refuses when the browser total no longer matches (a price changed) and says what the total is', async () => {
    await db.test.update({ where: { id: 'cbc' }, data: { price: 399 } });
    await expect(createOrder(me, base())).rejects.toMatchObject({ status: 409, code: 'price_changed', extra: { total: 399 + 99 } }); // ₹399 is still under ₹499, so the ₹99 collection fee applies
    await db.test.update({ where: { id: 'cbc' }, data: { price: 299 } });
  });

  it('ignores a tampered total: you cannot pay less by lying', async () => {
    await expect(createOrder(me, base({ expectedTotal: 1 }))).rejects.toMatchObject({ code: 'price_changed' });
    expect(await db.order.count()).toBe(0);
  });

  it('applies a coupon and free collection above ₹499, and counts the use', async () => {
    const o = await createOrder(me, base({ items: ['thyt', 'vitd'], coupon: 'AMMA10', expectedTotal: 539 + 899 - 144 })); // ₹1438, 10% = ₹144, free collection
    expect(o).toMatchObject({ couponCode: 'AMMA10', couponDiscount: 144, collectionFee: 0, total: 1294 });
    expect((await db.coupon.findUniqueOrThrow({ where: { code: 'AMMA10' } })).usedCount).toBe(1);
  });

  it('rejects unknown, expired and below-minimum coupons', async () => {
    await expect(createOrder(me, base({ coupon: 'NOPE' }))).rejects.toMatchObject({ code: 'coupon_invalid' });
    await db.coupon.update({ where: { code: 'AMMA10' }, data: { endsAt: new Date(Date.now() - 1000) } });
    await expect(createOrder(me, base({ coupon: 'AMMA10' }))).rejects.toMatchObject({ code: 'coupon_invalid' });
    await db.coupon.update({ where: { code: 'AMMA10' }, data: { endsAt: null } });
    await expect(createOrder(me, base({ coupon: 'FIRST100' }))).rejects.toMatchObject({ code: 'coupon_min_order' });
  });

  it('a coupon with a use limit cannot be over-used by parallel orders', async () => {
    await db.coupon.update({ where: { code: 'AMMA10' }, data: { maxUses: 1 } });
    const mk = (u: SessionUser) => createOrder(u, base({ items: ['thyt', 'vitd'], coupon: 'AMMA10', expectedTotal: 1294 }));
    const r = await Promise.allSettled([mk(me), mk(other)]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect((await db.coupon.findUniqueOrThrow({ where: { code: 'AMMA10' } })).usedCount).toBe(1);
    await db.coupon.update({ where: { code: 'AMMA10' }, data: { maxUses: null } });
  });

  it('rejects tests that are inactive or do not exist', async () => {
    await expect(createOrder(me, base({ items: ['nope'] }))).rejects.toMatchObject({ code: 'test_unavailable' });
    await db.test.update({ where: { id: 'cbc' }, data: { active: false } });
    await expect(createOrder(me, base())).rejects.toMatchObject({ code: 'test_unavailable' });
    await db.test.update({ where: { id: 'cbc' }, data: { active: true } });
  });

  it('centre-visit only orders need no address and pay no collection fee', async () => {
    const o = await createOrder(me, base({ items: ['ecg'], address: null, expectedTotal: 299 }));
    expect(o).toMatchObject({ homeCollection: false, collectionFee: 0, total: 299 });
    expect((await db.order.findFirstOrThrow()).addressLine).toBeNull();
  });
});

describe('createOrder: slots and address', () => {
  it('fasting tests only go in morning slots', async () => {
    await expect(createOrder(me, base({ items: ['fbs'], expectedTotal: 99 + 99, slot: { date: tomorrow(), slotId: 's1600' } }))).rejects.toMatchObject({ code: 'slot_morning_only' });
    await expect(createOrder(me, base({ items: ['fbs'], expectedTotal: 99 + 99, slot: { date: tomorrow(), slotId: 's0600' } }))).resolves.toBeTruthy();
  });

  it('only the next five days, starting tomorrow', async () => {
    const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
    await expect(createOrder(me, base({ slot: { date: today, slotId: 's1000' } }))).rejects.toMatchObject({ code: 'slot_date' });
    await expect(createOrder(me, base({ slot: { date: '2999-01-01', slotId: 's1000' } }))).rejects.toMatchObject({ code: 'slot_date' });
  });

  it('requires a serviceable address for home collection', async () => {
    await expect(createOrder(me, base({ address: null }))).rejects.toMatchObject({ code: 'invalid_input' });
    await expect(createOrder(me, base({ address: { line: 'short', pincode: '560038' } }))).rejects.toMatchObject({ code: 'invalid_input' });
    await expect(createOrder(me, base({ address: { line: '12, 4th Cross, Indiranagar', pincode: '110001' } }))).rejects.toMatchObject({ code: 'invalid_input' });
  });

  it('refuses a full slot and releases it again when the order is cancelled', async () => {
    await db.slot.update({ where: { id: 's1000' }, data: { capacity: 1 } });
    const first = await createOrder(me, base());
    await expect(createOrder(other, base())).rejects.toMatchObject({ code: 'slot_full' });
    const days = await listSlotDays();
    expect(days[0]!.slots.find((s) => s.id === 's1000')).toMatchObject({ remaining: 0, available: false });
    await cancelOrder(me, first.code);
    await expect(createOrder(other, base())).resolves.toBeTruthy();
    await db.slot.update({ where: { id: 's1000' }, data: { capacity: 20 } });
  });

  it('two people racing for the last place: exactly one gets it', async () => {
    await db.slot.update({ where: { id: 's1000' }, data: { capacity: 1 } });
    const r = await Promise.allSettled([createOrder(me, base()), createOrder(other, base())]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(await db.order.count()).toBe(1);
    await db.slot.update({ where: { id: 's1000' }, data: { capacity: 20 } });
  });

  it('an unpaid online order holds a slot for 15 minutes, then frees it', async () => {
    await db.slot.update({ where: { id: 's1000' }, data: { capacity: 1 } });
    const pending = await createOrder(me, base({ payMode: 'ONLINE' }));
    expect(pending).toMatchObject({ status: 'PENDING_PAYMENT', paymentStatus: 'PENDING' });
    await expect(createOrder(other, base())).rejects.toMatchObject({ code: 'slot_full' });
    await db.order.update({ where: { id: pending.id }, data: { createdAt: new Date(Date.now() - 16 * 60_000) } });
    await expect(createOrder(other, base())).resolves.toBeTruthy();
    await db.slot.update({ where: { id: 's1000' }, data: { capacity: 20 } });
  });
});

describe('createOrder: idempotency', () => {
  it('the same key returns the same order, not a second one', async () => {
    const input = base();
    const a = await createOrder(me, input);
    const b = await createOrder(me, input);
    expect(b.id).toBe(a.id);
    expect(await db.order.count()).toBe(1);
  });

  it('a double-click (parallel, same key) makes one order', async () => {
    const input = base();
    const r = await Promise.allSettled([createOrder(me, input), createOrder(me, input), createOrder(me, input)]);
    expect(r.every((x) => x.status === 'fulfilled')).toBe(true);
    expect(await db.order.count()).toBe(1);
  });

  it('remembers the patient and address for next time, without duplicating them', async () => {
    await createOrder(me, base());
    await createOrder(me, base());
    expect(await db.patient.count()).toBe(1);
    expect(await db.address.count()).toBe(1);
    expect((await db.patient.findFirstOrThrow()).isSelf).toBe(true);
  });
});

describe('order access control', () => {
  it('you can read your own order and nobody else can (404, not 403, so codes cannot be probed)', async () => {
    const o = await createOrder(me, base());
    await expect(getOrderFor(me, o.code)).resolves.toMatchObject({ code: o.code });
    await expect(getOrderFor(other, o.code)).rejects.toMatchObject({ status: 404 });
    await expect(getOrderFor(me, 'AL-ZZZZZZ')).rejects.toMatchObject({ status: 404 });
    expect(await listOrders(other.id)).toEqual([]);
    expect((await listOrders(me.id)).map((x) => x.code)).toEqual([o.code]);
  });

  it('staff can read any order', async () => {
    const o = await createOrder(me, base());
    await expect(getOrderFor({ ...other, role: 'TECHNICIAN' }, o.code)).resolves.toBeTruthy();
  });

  it('only the owner can cancel, and only before collection', async () => {
    const o = await createOrder(me, base());
    await expect(cancelOrder(other, o.code)).rejects.toMatchObject({ status: 404 });
    await db.order.update({ where: { id: o.id }, data: { status: 'SAMPLE_COLLECTED' } });
    await expect(cancelOrder(me, o.code)).rejects.toMatchObject({ code: 'not_cancellable' });
  });

  it('cancelling gives the coupon use back', async () => {
    const o = await createOrder(me, base({ items: ['thyt', 'vitd'], coupon: 'AMMA10', expectedTotal: 1294 }));
    await cancelOrder(me, o.code);
    expect((await db.coupon.findUniqueOrThrow({ where: { code: 'AMMA10' } })).usedCount).toBe(0);
  });

  it('writes an audit trail without money or personal details', async () => {
    await createOrder(me, base());
    const log = await db.auditLog.findFirstOrThrow({ where: { action: 'order.create' } });
    expect(Object.keys(log.meta as object).sort()).toEqual(['code', 'payMode', 'total']);
  });
});

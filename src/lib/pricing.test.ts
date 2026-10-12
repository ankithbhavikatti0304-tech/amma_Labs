import { describe, expect, it } from 'vitest';
import { computeBill, couponDiscount, discountPercent, type BillItem, type CouponRule, type FeeConfig } from './pricing';

const fees: FeeConfig = { freeCollectionAbove: 499, collectionFee: 99, hardCopyFee: 150 };
const AMMA10: CouponRule = { code: 'AMMA10', type: 'PERCENT', value: 10, cap: 300, minOrder: 0 };
const FIRST100: CouponRule = { code: 'FIRST100', type: 'FLAT', value: 100, minOrder: 999 };
const test = (id: string, price: number, mrp = price, centreVisit = false): BillItem => ({ id, price, mrp, centreVisit });

describe('couponDiscount', () => {
  it('AMMA10 is 10% rounded, capped at ₹300', () => {
    expect(couponDiscount(AMMA10, 1000)).toBe(100);
    expect(couponDiscount(AMMA10, 3999)).toBe(300);
    expect(couponDiscount(AMMA10, 155)).toBe(16); // 15.5 rounds up
  });
  it('FIRST100 needs ₹999 or more', () => {
    expect(couponDiscount(FIRST100, 998)).toBe(0);
    expect(couponDiscount(FIRST100, 999)).toBe(100);
  });
  it('never discounts more than the basket', () => {
    expect(couponDiscount({ code: 'X', type: 'FLAT', value: 500, minOrder: 0 }, 200)).toBe(200);
  });
  it('no coupon, no discount', () => {
    expect(couponDiscount(null, 5000)).toBe(0);
  });
});

describe('computeBill', () => {
  it('free home collection at ₹499 or more after coupon', () => {
    expect(computeBill({ items: [test('a', 499)], fees }).collectionFee).toBe(0);
    expect(computeBill({ items: [test('a', 498)], fees }).collectionFee).toBe(99);
  });
  it('collection fee is judged after the coupon, not before', () => {
    // ₹520 with AMMA10 → ₹468 after coupon, under ₹499, so the fee applies
    const b = computeBill({ items: [test('a', 520)], coupon: AMMA10, fees });
    expect(b.couponDiscount).toBe(52);
    expect(b.collectionFee).toBe(99);
    expect(b.total).toBe(520 - 52 + 99);
    expect(b.awayFromFreeCollection).toBe(499 - 468);
  });
  it('centre-visit only baskets pay no collection fee', () => {
    const b = computeBill({ items: [test('xray', 399, 450, true)], fees });
    expect(b.homeCollection).toBe(false);
    expect(b.collectionFee).toBe(0);
    expect(b.total).toBe(399);
  });
  it('one home test in a mixed basket still means home collection', () => {
    expect(computeBill({ items: [test('xray', 100, 100, true), test('cbc', 100)], fees }).homeCollection).toBe(true);
  });
  it('hard copy adds the fee only when there are items', () => {
    expect(computeBill({ items: [test('a', 600)], hardCopy: true, fees }).total).toBe(750);
    expect(computeBill({ items: [], hardCopy: true, fees }).total).toBe(0);
  });
  it('reports MRP, selling price and discount', () => {
    const b = computeBill({ items: [test('a', 3999, 7998), test('b', 299, 399)], fees });
    expect(b.mrpTotal).toBe(8397);
    expect(b.priceTotal).toBe(4298);
    expect(b.discount).toBe(4099);
  });
});

describe('discountPercent', () => {
  it('rounds, and is 0 when MRP is not higher', () => {
    expect(discountPercent({ price: 3999, mrp: 7998 })).toBe(50);
    expect(discountPercent({ price: 169, mrp: 169 })).toBe(0);
    expect(discountPercent({ price: 299, mrp: 399 })).toBe(25);
  });
});

/**
 * The bill. One pure function used by the browser (instant cart totals) and by the server
 * (the authoritative price when an order is placed). The client's numbers are never trusted.
 */
export interface BillItem {
  id: string;
  price: number;
  mrp: number;
  centreVisit: boolean;
}

export interface CouponRule {
  code: string;
  type: 'PERCENT' | 'FLAT';
  value: number;
  cap?: number | null;
  minOrder: number;
}

export interface FeeConfig {
  freeCollectionAbove: number;
  collectionFee: number;
  hardCopyFee: number;
}

export interface Bill {
  mrpTotal: number;
  priceTotal: number;
  /** MRP minus selling price. */
  discount: number;
  couponDiscount: number;
  /** True if any item needs a home sample collection. */
  homeCollection: boolean;
  collectionFee: number;
  hardCopyFee: number;
  total: number;
  /** Rupees still needed for free home collection, 0 if already free or not applicable. */
  awayFromFreeCollection: number;
}

/** Discount a coupon gives on a basket whose selling-price total is `price`. 0 if it doesn't apply. */
export function couponDiscount(coupon: CouponRule | null | undefined, price: number): number {
  if (!coupon || price < coupon.minOrder) return 0;
  if (coupon.type === 'PERCENT') {
    const raw = Math.round((price * coupon.value) / 100);
    return Math.min(raw, coupon.cap ?? Number.POSITIVE_INFINITY, price);
  }
  return Math.min(coupon.value, price);
}

export function computeBill(args: { items: BillItem[]; coupon?: CouponRule | null; hardCopy?: boolean; fees: FeeConfig }): Bill {
  const { items, coupon, hardCopy, fees } = args;
  const mrpTotal = items.reduce((s, t) => s + t.mrp, 0);
  const priceTotal = items.reduce((s, t) => s + t.price, 0);
  const cpn = couponDiscount(coupon, priceTotal);
  const homeCollection = items.some((t) => !t.centreVisit);
  const afterCoupon = priceTotal - cpn;
  const collectionFee = homeCollection && afterCoupon < fees.freeCollectionAbove ? fees.collectionFee : 0;
  const hardCopyFee = hardCopy && items.length ? fees.hardCopyFee : 0;
  return {
    mrpTotal,
    priceTotal,
    discount: mrpTotal - priceTotal,
    couponDiscount: cpn,
    homeCollection,
    collectionFee,
    hardCopyFee,
    total: afterCoupon + collectionFee + hardCopyFee,
    awayFromFreeCollection: homeCollection && collectionFee ? fees.freeCollectionAbove - afterCoupon : 0,
  };
}

export const discountPercent = (t: { price: number; mrp: number }): number =>
  t.mrp > t.price ? Math.round((1 - t.price / t.mrp) * 100) : 0;

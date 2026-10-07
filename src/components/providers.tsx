'use client';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import type { CatalogueData, CouponDTO, TestDTO } from '@/lib/catalogue';
import { computeBill, type Bill } from '@/lib/pricing';
import { cart, useCart } from '@/lib/client/cart';
import type { SessionUser } from '@/server/auth/session';

interface AppValue extends CatalogueData {
  byId: Map<string, TestDTO>;
  user: SessionUser | null;
  city: string;
}

const Ctx = createContext<AppValue | null>(null);

export function AppProviders({ data, user, city, children }: { data: CatalogueData; user: SessionUser | null; city: string; children: ReactNode }) {
  const value = useMemo<AppValue>(() => ({ ...data, byId: new Map(data.tests.map((t) => [t.id, t])), user, city }), [data, user, city]);
  // A retired test must not linger in someone's saved cart.
  useEffect(() => cart.prune(new Set(data.tests.map((t) => t.id))), [data.tests]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProviders');
  return v;
}
export const useUser = () => useApp().user;

export interface CartDetail {
  items: TestDTO[];
  coupon: CouponDTO | null;
  hard: boolean;
  bill: Bill;
}

/** The cart joined with catalogue data, and its bill. The server recomputes all of this at checkout. */
export function useCartDetail(): CartDetail {
  const { ids, hard, coupon: code } = useCart();
  const { byId, coupons, settings } = useApp();
  return useMemo(() => {
    const items = ids.map((id) => byId.get(id)).filter((t): t is TestDTO => !!t);
    const coupon = coupons.find((c) => c.code === code) ?? null;
    const bill = computeBill({
      items: items.map((t) => ({ id: t.id, price: t.price, mrp: t.mrp, centreVisit: t.centreVisit })),
      coupon,
      hardCopy: hard,
      fees: settings,
    });
    return { items, coupon, hard, bill };
  }, [ids, hard, code, byId, coupons, settings]);
}

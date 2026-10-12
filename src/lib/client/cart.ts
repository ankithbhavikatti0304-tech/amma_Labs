'use client';
import { useSyncExternalStore } from 'react';
import { createStore } from './store';

/**
 * The cart lives in the browser (localStorage) until checkout, where the server re-prices
 * everything. Updates are instant: components subscribe to exactly what they show, so
 * adding one test re-renders that test's button, the cart count and the dock, not the page.
 */
export interface CartState {
  ids: string[];
  hard: boolean;
  coupon: string | null;
}

const KEY = 'ammaLabs.cart.v1';
const EMPTY: CartState = Object.freeze({ ids: [], hard: false, coupon: null }) as CartState;

function read(): CartState {
  try {
    const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const d = JSON.parse(raw) as Partial<CartState>;
    const ids = Array.isArray(d.ids) ? [...new Set(d.ids.filter((x): x is string => typeof x === 'string'))].slice(0, 50) : [];
    return { ids, hard: d.hard === true, coupon: typeof d.coupon === 'string' ? d.coupon : null };
  } catch {
    return EMPTY;
  }
}

const store = createStore<CartState>(read());

function persist(s: CartState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode or full storage: the cart still works for this page view */
  }
}

if (typeof window !== 'undefined') {
  // Keep tabs in step.
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) store.set(read());
  });
}

const update = (fn: (s: CartState) => CartState) => {
  store.set((s) => fn(s));
  persist(store.get());
};

export const cart = {
  has: (id: string) => store.get().ids.includes(id),
  /** Returns true if the item is now in the cart. */
  toggle(id: string): boolean {
    const was = store.get().ids.includes(id);
    update((s) => ({ ...s, ids: was ? s.ids.filter((x) => x !== id) : [...s.ids, id] }));
    return !was;
  },
  remove: (id: string) => update((s) => ({ ...s, ids: s.ids.filter((x) => x !== id) })),
  setHard: (hard: boolean) => update((s) => ({ ...s, hard })),
  setCoupon: (coupon: string | null) => update((s) => ({ ...s, coupon })),
  clear: () => update(() => EMPTY),
  /** Drop ids that are no longer in the catalogue (a test was retired). */
  prune(valid: Set<string>) {
    const s = store.get();
    if (s.ids.some((id) => !valid.has(id))) update((c) => ({ ...c, ids: c.ids.filter((id) => valid.has(id)) }));
  },
};

export const useCart = (): CartState => useSyncExternalStore(store.subscribe, store.get, () => EMPTY);
/** True/false only: re-renders when this one item flips. */
export const useInCart = (id: string): boolean => useSyncExternalStore(store.subscribe, () => store.get().ids.includes(id), () => false);

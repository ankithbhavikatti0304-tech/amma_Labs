/** A minimal external store for useSyncExternalStore. */
export interface Store<T> {
  get(): T;
  set(next: T | ((s: T) => T)): void;
  subscribe(fn: () => void): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const subs = new Set<() => void>();
  return {
    get: () => state,
    set(next) {
      const n = typeof next === 'function' ? (next as (s: T) => T)(state) : next;
      if (Object.is(n, state)) return;
      state = n;
      subs.forEach((f) => f());
    },
    subscribe(fn) {
      subs.add(fn);
      return () => void subs.delete(fn);
    },
  };
}

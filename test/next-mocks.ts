import { vi } from 'vitest';

/** An in-memory cookie jar standing in for next/headers during route tests. */
export const jar = new Map<string, { value: string; opts: Record<string, unknown> }>();

export function mockNextHeaders() {
  vi.mock('next/headers', () => ({
    cookies: async () => ({
      get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)!.value } : undefined),
      set: (name: string, value: string, opts: Record<string, unknown> = {}) => {
        if (opts.maxAge === 0) jar.delete(name);
        else jar.set(name, { value, opts });
      },
    }),
    headers: async () => new Headers(),
  }));
  vi.mock('next/navigation', () => ({
    redirect: (to: string) => {
      throw new Error(`REDIRECT:${to}`);
    },
  }));
}

export function req(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  return new Request(`http://localhost:3000${path}`, {
    method: init.method ?? 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', ...init.headers },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

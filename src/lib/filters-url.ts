import type { Filters } from './catalogue';

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Read ?pkg=1&fast=1&nofast=1&sort=lo|hi|tat from a page's searchParams. */
export function filtersFromParams(p: Params): Filters {
  const sort = one(p.sort);
  return {
    pkg: one(p.pkg) === '1',
    fast24: one(p.fast) === '1',
    nofast: one(p.nofast) === '1',
    sort: sort === 'lo' || sort === 'hi' || sort === 'tat' ? sort : 'pop',
  };
}

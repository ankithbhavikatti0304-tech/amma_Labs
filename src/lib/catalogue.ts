/** Client-safe catalogue types and the search/filter logic (ported from the prototype). */
export interface TestDTO {
  id: string;
  slug: string;
  name: string;
  isPackage: boolean;
  parameterCount: number | null;
  tatMin: number;
  tatMax: number;
  price: number;
  mrp: number;
  fasting: boolean;
  morningSample: boolean;
  centreVisit: boolean;
  popular: boolean;
  includes: string[];
  categories: string[];
  mascot: string;
  mascotArg: string | null;
  tint: string;
}

export interface CategoryDTO {
  id: string;
  name: string;
  icon: string;
  tint: string;
  mascot: string;
  mascotArg: string | null;
}

export interface CouponDTO {
  code: string;
  description: string;
  type: 'PERCENT' | 'FLAT';
  value: number;
  cap: number | null;
  minOrder: number;
}

export interface PublicSettings {
  phone: string;
  whatsapp: string;
  hours: string;
  freeCollectionAbove: number;
  collectionFee: number;
  hardCopyFee: number;
}

export interface CatalogueData {
  categories: CategoryDTO[];
  tests: TestDTO[];
  coupons: CouponDTO[];
  settings: PublicSettings;
}

/** "12–24" or "72" */
export const tatRange = (t: Pick<TestDTO, 'tatMin' | 'tatMax'>): string => (t.tatMin === t.tatMax ? String(t.tatMin) : `${t.tatMin}–${t.tatMax}`);

export interface Filters {
  pkg: boolean;
  fast24: boolean;
  nofast: boolean;
  sort: 'pop' | 'lo' | 'hi' | 'tat';
}

export const DEFAULT_FILTERS: Filters = { pkg: false, fast24: false, nofast: false, sort: 'pop' };

export function applyFilters(list: TestDTO[], f: Filters): TestDTO[] {
  let l = list.slice();
  if (f.pkg) l = l.filter((t) => t.isPackage);
  if (f.fast24) l = l.filter((t) => t.tatMax <= 24);
  if (f.nofast) l = l.filter((t) => !t.fasting);
  if (f.sort === 'lo') l.sort((a, b) => a.price - b.price);
  else if (f.sort === 'hi') l.sort((a, b) => b.price - a.price);
  else if (f.sort === 'tat') l.sort((a, b) => a.tatMax - b.tatMax);
  else l.sort((a, b) => Number(b.popular) - Number(a.popular)); // stable: keeps catalogue order within each group
  return l;
}

/** Tests in a category. "full" means every package, as in the prototype. */
export const inCategory = (tests: TestDTO[], id: string): TestDTO[] =>
  id === 'all' ? tests : id === 'full' ? tests.filter((t) => t.isPackage) : tests.filter((t) => t.categories.includes(id));

/**
 * Search as you type: every word must appear in the name, the included parameters, or the
 * category. Names that start with the query come first.
 */
export function findTests(tests: TestDTO[], categories: CategoryDTO[], query: string): TestDTO[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const catName = new Map(categories.map((c) => [c.id, c.name.toLowerCase()]));
  const words = q.split(/\s+/);
  return tests
    .filter((t) => {
      const hay = `${t.name} ${t.includes.join(' ')} ${t.categories.map((c) => `${c} ${catName.get(c) ?? ''}`).join(' ')}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    })
    .sort((a, b) => Number(b.name.toLowerCase().startsWith(q)) - Number(a.name.toLowerCase().startsWith(q)));
}

export const SEGMENTS = [['all', 'All'], ['men', 'Men'], ['women', 'Women'], ['senior', 'Seniors'], ['fit', 'Fitness']] as const;
export type Segment = (typeof SEGMENTS)[number][0];

/** The packages shown on the home page rail for a segment. */
export function packageSegment(tests: TestDTO[], seg: Segment): TestDTO[] {
  const pk = tests.filter((t) => t.isPackage);
  if (seg === 'men') return pk.filter((t) => t.categories.includes('men'));
  if (seg === 'women') return pk.filter((t) => t.categories.includes('women'));
  if (seg === 'senior') return pk.filter((t) => /senior/i.test(t.name));
  if (seg === 'fit') return pk.filter((t) => /fitness/i.test(t.name));
  return pk.slice().sort((a, b) => Number(b.popular) - Number(a.popular));
}

/** "Most booked": popular single tests first, topped up with other single tests, up to `n`. */
export function mostBooked(tests: TestDTO[], n = 8): TestDTO[] {
  const singles = tests.filter((t) => !t.isPackage && !t.centreVisit);
  const pop = singles.filter((t) => t.popular);
  const rest = singles.filter((t) => !t.popular);
  return [...pop, ...rest].slice(0, n);
}

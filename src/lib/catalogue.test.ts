import { describe, expect, it } from 'vitest';
import { applyFilters, DEFAULT_FILTERS, findTests, inCategory, tatRange, type CategoryDTO, type TestDTO } from './catalogue';

const t = (o: Partial<TestDTO> & { id: string }): TestDTO => ({
  slug: o.id, name: o.id, isPackage: false, parameterCount: null, tatMin: 12, tatMax: 24, price: 100, mrp: 100, fasting: false,
  morningSample: false, centreVisit: false, popular: false, includes: [], categories: [], mascot: 'drop', mascotArg: null, tint: 'a', ...o,
});
const cats: CategoryDTO[] = [{ id: 'liver', name: 'Liver & kidney', icon: 'liver', tint: 'c', mascot: 'lk', mascotArg: null }];
const list = [
  t({ id: 'a', name: 'LFT (Liver Function Test)', categories: ['liver'], price: 439, tatMax: 24, popular: true, includes: ['SGOT (AST)', 'Albumin'] }),
  t({ id: 'b', name: 'Thyroid Profile', categories: ['thyroid'], price: 539, tatMax: 12, fasting: true }),
  t({ id: 'c', name: 'Full Body Package', categories: ['full', 'men'], isPackage: true, price: 3999, tatMin: 36, tatMax: 48, fasting: true }),
];

describe('tatRange', () => {
  it('shows a range or a single number', () => {
    expect(tatRange({ tatMin: 12, tatMax: 24 })).toBe('12–24');
    expect(tatRange({ tatMin: 72, tatMax: 72 })).toBe('72');
  });
});

describe('applyFilters', () => {
  it('filters packages, 24-hour and no-fasting', () => {
    expect(applyFilters(list, { ...DEFAULT_FILTERS, pkg: true }).map((x) => x.id)).toEqual(['c']);
    expect(applyFilters(list, { ...DEFAULT_FILTERS, fast24: true }).map((x) => x.id).sort()).toEqual(['a', 'b']);
    expect(applyFilters(list, { ...DEFAULT_FILTERS, nofast: true }).map((x) => x.id)).toEqual(['a']);
  });
  it('sorts by price and speed, popular first by default', () => {
    expect(applyFilters(list, { ...DEFAULT_FILTERS, sort: 'lo' }).map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(applyFilters(list, { ...DEFAULT_FILTERS, sort: 'hi' }).map((x) => x.id)).toEqual(['c', 'b', 'a']);
    expect(applyFilters(list, { ...DEFAULT_FILTERS, sort: 'tat' }).map((x) => x.id)).toEqual(['b', 'a', 'c']);
    expect(applyFilters(list, DEFAULT_FILTERS)[0]!.id).toBe('a');
  });
  it('does not mutate the input', () => {
    const copy = list.map((x) => x.id);
    applyFilters(list, { ...DEFAULT_FILTERS, sort: 'hi' });
    expect(list.map((x) => x.id)).toEqual(copy);
  });
});

describe('inCategory', () => {
  it('"full" is every package, "all" is everything', () => {
    expect(inCategory(list, 'full').map((x) => x.id)).toEqual(['c']);
    expect(inCategory(list, 'all')).toHaveLength(3);
    expect(inCategory(list, 'liver').map((x) => x.id)).toEqual(['a']);
  });
});

describe('findTests', () => {
  it('matches names, included parameters and category names', () => {
    expect(findTests(list, cats, 'thyroid').map((x) => x.id)).toEqual(['b']);
    expect(findTests(list, cats, 'albumin').map((x) => x.id)).toEqual(['a']);
    expect(findTests(list, cats, 'kidney').map((x) => x.id)).toEqual(['a']);
  });
  it('needs every word to match, in any order, case-insensitively', () => {
    expect(findTests(list, cats, 'TEST liver').map((x) => x.id)).toEqual(['a']);
    expect(findTests(list, cats, 'liver thyroid')).toEqual([]);
  });
  it('puts names that start with the query first', () => {
    const l = [t({ id: 'x', name: 'Anti Thyroid Antibodies' }), t({ id: 'y', name: 'Thyroid Profile' })];
    expect(findTests(l, cats, 'thyroid').map((x) => x.id)).toEqual(['y', 'x']);
  });
  it('returns nothing for an empty query', () => {
    expect(findTests(list, cats, '   ')).toEqual([]);
  });
});

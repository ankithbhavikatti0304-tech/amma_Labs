import { describe, expect, it } from 'vitest';
import { flagFor, pickRange, rangePosition, roundTo, type RangeRule } from './results';

describe('flagFor', () => {
  const r = { low: 13, high: 17 };
  it('bounds are inclusive', () => {
    expect(flagFor(13, r)).toBe('NORMAL');
    expect(flagFor(17, r)).toBe('NORMAL');
    expect(flagFor(12.9, r)).toBe('LOW');
    expect(flagFor(17.1, r)).toBe('HIGH');
  });
  it('handles one-sided ranges', () => {
    expect(flagFor(250, { low: null, high: 200 })).toBe('HIGH');
    expect(flagFor(1, { low: null, high: 200 })).toBe('NORMAL');
    expect(flagFor(20, { low: 30, high: null })).toBe('LOW');
  });
  it('is judged on the rounded displayed value', () => {
    expect(flagFor(roundTo(17.04, 1), r)).toBe('NORMAL');
  });
});

describe('rangePosition', () => {
  it('puts the middle of the range in the middle of the bar', () => {
    expect(rangePosition(15, { low: 13, high: 17 })).toBeCloseTo(50);
  });
  it('puts the range edges at 25% and 75%', () => {
    expect(rangePosition(13, { low: 13, high: 17 })).toBeCloseTo(25);
    expect(rangePosition(17, { low: 13, high: 17 })).toBeCloseTo(75);
  });
  it('clamps extreme values', () => {
    expect(rangePosition(0, { low: 13, high: 17 })).toBe(2);
    expect(rangePosition(100, { low: 13, high: 17 })).toBe(98);
  });
  it('centres when there is no two-sided range', () => {
    expect(rangePosition(5, { low: null, high: 10 })).toBe(50);
  });
});

describe('pickRange', () => {
  const defaults = { low: 13, high: 17 };
  const rules: RangeRule[] = [
    { sex: 'FEMALE', ageMin: null, ageMax: null, low: 12, high: 15.5 },
    { sex: 'FEMALE', ageMin: 60, ageMax: null, low: 11.5, high: 15 },
    { sex: null, ageMin: 0, ageMax: 12, low: 11, high: 14 },
  ];
  it('falls back to the default when nothing matches', () => {
    expect(pickRange(defaults, rules, { sex: 'MALE', age: 40 })).toEqual(defaults);
  });
  it('uses a sex-specific rule', () => {
    expect(pickRange(defaults, rules, { sex: 'FEMALE', age: 30 })).toEqual({ low: 12, high: 15.5 });
  });
  it('prefers the most specific rule', () => {
    expect(pickRange(defaults, rules, { sex: 'FEMALE', age: 70 })).toEqual({ low: 11.5, high: 15 });
  });
  it('applies age-only rules to anyone in that age band', () => {
    expect(pickRange(defaults, rules, { sex: 'MALE', age: 8 })).toEqual({ low: 11, high: 14 });
  });
});

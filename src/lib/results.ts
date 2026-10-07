/** Result flags and the "where it sits" bar on the report. */
export type NumericFlag = 'NORMAL' | 'HIGH' | 'LOW';

export interface RangeBounds {
  low: number | null;
  high: number | null;
}

/** Bounds are inclusive: a value equal to the limit is normal. Compare after rounding to the displayed decimals. */
export function flagFor(value: number, { low, high }: RangeBounds): NumericFlag {
  if (low !== null && value < low) return 'LOW';
  if (high !== null && value > high) return 'HIGH';
  return 'NORMAL';
}

export const roundTo = (v: number, decimals: number): number => Number(v.toFixed(decimals));

/**
 * Position (2–98 %) of a value along a bar that spans half a range-width either side of the
 * reference range, so the green zone sits in the middle half of the bar. Same as the prototype.
 */
export function rangePosition(value: number, { low, high }: RangeBounds): number {
  if (low === null || high === null || high <= low) return 50;
  const span = high - low;
  const pos = ((value - (low - span / 2)) / (span * 2)) * 100;
  return Math.min(98, Math.max(2, pos));
}

export interface RangeRule {
  sex: 'MALE' | 'FEMALE' | 'OTHER' | null;
  ageMin: number | null;
  ageMax: number | null;
  low: number;
  high: number;
}

/**
 * Pick the reference range for a patient. The most specific matching rule wins
 * (sex + age beats sex-only or age-only beats nothing); if none match, use the default.
 */
export function pickRange(
  defaults: RangeBounds,
  rules: RangeRule[],
  patient: { sex: 'MALE' | 'FEMALE' | 'OTHER'; age: number },
): RangeBounds {
  let best: { rule: RangeRule; score: number } | null = null;
  for (const r of rules) {
    if (r.sex !== null && r.sex !== patient.sex) continue;
    if (r.ageMin !== null && patient.age < r.ageMin) continue;
    if (r.ageMax !== null && patient.age > r.ageMax) continue;
    const score = (r.sex !== null ? 2 : 0) + (r.ageMin !== null ? 1 : 0) + (r.ageMax !== null ? 1 : 0);
    if (!best || score > best.score) best = { rule: r, score };
  }
  return best ? { low: best.rule.low, high: best.rule.high } : defaults;
}

export const FLAG_LABEL = { NORMAL: 'Normal', HIGH: 'High', LOW: 'Low', ABNORMAL: 'Abnormal' } as const;

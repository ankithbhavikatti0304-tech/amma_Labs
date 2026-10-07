import { describe, expect, it } from 'vitest';
import { buildReport, evaluateNumeric, rangeText, type StoredResult } from './report';

const res = (o: Partial<StoredResult> & { parameterId: string }): StoredResult => ({
  valueNum: 1, valueText: null, flag: 'NORMAL', unit: 'g/dL', refLow: 13, refHigh: 17, refText: null, decimals: 1, ...o,
});
const order = { code: 'AL-ABC234', patientName: 'Lakshmi Rao', patientAge: 34, patientGender: 'FEMALE' as const };

describe('rangeText', () => {
  it('formats two-sided, one-sided and text ranges', () => {
    expect(rangeText(13, 17, 1, null)).toBe('13 – 17');
    expect(rangeText(0.27, 4.2, 2, null)).toBe('0.27 – 4.2');
    expect(rangeText(null, 200, 0, null)).toBe('< 200');
    expect(rangeText(30, null, 0, null)).toBe('> 30');
    expect(rangeText(null, null, 0, 'Negative')).toBe('Negative');
    expect(rangeText(null, null, 0, null)).toBeNull();
  });
});

describe('evaluateNumeric', () => {
  const p = { decimals: 1, refLow: 13, refHigh: 17 };
  it('rounds first, so the flag matches what is printed', () => {
    expect(evaluateNumeric(17.04, p, [], { sex: 'MALE', age: 30 })).toMatchObject({ value: 17, flag: 'NORMAL' });
    expect(evaluateNumeric(17.06, p, [], { sex: 'MALE', age: 30 })).toMatchObject({ value: 17.1, flag: 'HIGH' });
    expect(evaluateNumeric(9.9, p, [], { sex: 'MALE', age: 30 }).flag).toBe('LOW');
  });
  it('uses a sex-specific range when one exists', () => {
    const rules = [{ sex: 'FEMALE' as const, ageMin: null, ageMax: null, low: 12, high: 15.5 }];
    expect(evaluateNumeric(12.5, p, rules, { sex: 'FEMALE', age: 30 })).toMatchObject({ flag: 'NORMAL', low: 12, high: 15.5 });
    expect(evaluateNumeric(12.5, p, rules, { sex: 'MALE', age: 30 })).toMatchObject({ flag: 'LOW', low: 13, high: 17 });
  });
});

describe('buildReport', () => {
  const tests = [
    { id: 't1', name: 'Lipid profile', parameters: [{ parameterId: 'chol', name: 'Total cholesterol', groupName: 'Lipid profile' }, { parameterId: 'hdl', name: 'HDL', groupName: 'Lipid profile' }] },
    { id: 't2', name: 'Full body', parameters: [{ parameterId: 'chol', name: 'Total cholesterol', groupName: 'Lipid profile' }, { parameterId: 'hb', name: 'Hemoglobin', groupName: null }] },
  ];
  const results = new Map<string, StoredResult>([
    ['chol', res({ parameterId: 'chol', valueNum: 230, flag: 'HIGH', unit: 'mg/dL', refLow: 125, refHigh: 200, decimals: 0 })],
    ['hdl', res({ parameterId: 'hdl', valueNum: 45, unit: 'mg/dL', refLow: 40, refHigh: 60, decimals: 0 })],
    ['hb', res({ parameterId: 'hb', valueNum: 14.2 })],
  ]);
  const r = buildReport({ order, collected: 'Thu, 8 Oct', releasedAt: new Date('2026-10-09T05:00:00Z'), verifiedBy: 'Dr A', tests, results });

  it('shows a parameter once, under the first test that has it', () => {
    expect(r.tests.find((t) => t.id === 't1')!.groups[0]!.rows.map((x) => x.name)).toEqual(['Total cholesterol', 'HDL']);
    expect(r.tests.find((t) => t.id === 't2')!.groups.flatMap((g) => g.rows).map((x) => x.name)).toEqual(['Hemoglobin']);
  });
  it('counts values within and outside range', () => {
    expect(r.summary).toEqual({ within: 2, outside: 1 });
  });
  it('formats values to the stored decimals, with the stored range', () => {
    const row = r.tests[0]!.groups[0]!.rows[0]!;
    expect(row).toMatchObject({ value: '230', unit: 'mg/dL', range: '125 – 200', flag: 'HIGH' });
    expect(row.position).toBeGreaterThan(75);
    expect(r.tests[1]!.groups[0]!.rows[0]!.value).toBe('14.2');
  });
  it('skips parameters with no result and drops empty tests', () => {
    const partial = buildReport({ order, collected: '', releasedAt: new Date(), verifiedBy: 'x', tests, results: new Map([['hb', results.get('hb')!]]) });
    expect(partial.tests.map((t) => t.id)).toEqual(['t2']);
  });
  it('carries text results without a position', () => {
    const rr = buildReport({
      order, collected: '', releasedAt: new Date(), verifiedBy: 'x',
      tests: [{ id: 'ns1', name: 'Dengue NS1', parameters: [{ parameterId: 'p', name: 'Dengue NS1', groupName: null }] }],
      results: new Map([['p', res({ parameterId: 'p', valueNum: null, valueText: 'Negative', refText: 'Negative', refLow: null, refHigh: null, unit: '' })]]),
    });
    expect(rr.tests[0]!.groups[0]!.rows[0]).toMatchObject({ value: 'Negative', range: 'Negative', position: null });
  });
});

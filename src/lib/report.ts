import { flagFor, pickRange, rangePosition, roundTo, type RangeRule } from './results';

/** The report as shown on screen and printed to PDF. Built from stored results only. */
export type ReportFlag = 'NORMAL' | 'HIGH' | 'LOW' | 'ABNORMAL';

export interface ReportRow {
  name: string;
  value: string;
  unit: string;
  /** "13 – 17", "< 200", "Negative" or null */
  range: string | null;
  flag: ReportFlag;
  /** 2–98 position on the range bar, only for numeric results with a two-sided range. */
  position: number | null;
}

export interface ReportGroup {
  heading: string | null;
  rows: ReportRow[];
}

export interface ReportDTO {
  code: string;
  patient: { name: string; age: number; gender: 'MALE' | 'FEMALE' | 'OTHER' };
  /** When the sample was collected, formatted for display. */
  collected: string;
  /** ISO time the report was released. */
  releasedAt: string;
  verifiedBy: string;
  tests: { id: string; name: string; groups: ReportGroup[] }[];
  summary: { within: number; outside: number };
}

export interface StoredResult {
  parameterId: string;
  valueNum: number | null;
  valueText: string | null;
  flag: ReportFlag;
  unit: string;
  refLow: number | null;
  refHigh: number | null;
  refText: string | null;
  decimals: number;
}

export interface ReportTestInput {
  id: string;
  name: string;
  parameters: { parameterId: string; name: string; groupName: string | null }[];
}

/** "13 – 17", "< 200", "> 30", or null when there is no range. */
export function rangeText(low: number | null, high: number | null, decimals: number, refText: string | null): string | null {
  const f = (n: number) => String(roundTo(n, Math.max(decimals, 0)));
  if (low !== null && high !== null) return `${f(low)} – ${f(high)}`;
  if (high !== null) return `< ${f(high)}`;
  if (low !== null) return `> ${f(low)}`;
  return refText;
}

/**
 * Turn stored results into report rows. A parameter that appears in more than one test of the
 * order is shown once, under the first test. Parameters without a result are left out
 * (the release step refuses to publish an incomplete report, so this only matters for previews).
 */
export function buildReport(args: {
  order: { code: string; patientName: string; patientAge: number; patientGender: 'MALE' | 'FEMALE' | 'OTHER' };
  collected: string;
  releasedAt: Date;
  verifiedBy: string;
  tests: ReportTestInput[];
  results: Map<string, StoredResult>;
}): ReportDTO {
  const seen = new Set<string>();
  let within = 0;
  let outside = 0;
  const tests = args.tests.map((t) => {
    const groups: ReportGroup[] = [];
    for (const p of t.parameters) {
      if (seen.has(p.parameterId)) continue;
      const r = args.results.get(p.parameterId);
      if (!r) continue;
      seen.add(p.parameterId);
      const numeric = r.valueNum !== null;
      const value = numeric ? r.valueNum!.toFixed(r.decimals) : (r.valueText ?? '');
      const row: ReportRow = {
        name: p.name,
        value,
        unit: r.unit,
        range: rangeText(r.refLow, r.refHigh, r.decimals, r.refText),
        flag: r.flag,
        position: numeric && r.refLow !== null && r.refHigh !== null ? rangePosition(Number(value), { low: r.refLow, high: r.refHigh }) : null,
      };
      if (r.flag === 'NORMAL') within++;
      else outside++;
      let g = groups.find((x) => x.heading === p.groupName);
      if (!g) groups.push((g = { heading: p.groupName, rows: [] }));
      g.rows.push(row);
    }
    return { id: t.id, name: t.name, groups };
  });
  return {
    code: args.order.code,
    patient: { name: args.order.patientName, age: args.order.patientAge, gender: args.order.patientGender },
    collected: args.collected,
    releasedAt: args.releasedAt.toISOString(),
    verifiedBy: args.verifiedBy,
    tests: tests.filter((t) => t.groups.length),
    summary: { within, outside },
  };
}

/**
 * Compute what to store for a numeric entry: the value rounded to the parameter's decimals,
 * the range that applies to this patient, and the flag. Rounding comes first so the flag
 * matches what the patient will read.
 */
export function evaluateNumeric(
  raw: number,
  p: { decimals: number; refLow: number | null; refHigh: number | null },
  rules: RangeRule[],
  patient: { sex: 'MALE' | 'FEMALE' | 'OTHER'; age: number },
): { value: number; low: number | null; high: number | null; flag: 'NORMAL' | 'HIGH' | 'LOW' } {
  const value = roundTo(raw, p.decimals);
  const { low, high } = pickRange({ low: p.refLow, high: p.refHigh }, rules, patient);
  return { value, low, high, flag: flagFor(value, { low, high }) };
}

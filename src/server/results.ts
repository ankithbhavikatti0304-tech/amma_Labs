import 'server-only';
import { db } from './db';
import { storage } from './storage';
import { audit } from './audit';
import { notifyOrder } from './notify';
import { ApiError } from './http-errors';
import { loadSettings } from './settings';
import { renderReportPdf } from './pdf/report-pdf';
import { buildReport, evaluateNumeric, rangeText, type ReportDTO, type ReportTestInput, type StoredResult } from '@/lib/report';
import { pickRange, type RangeRule } from '@/lib/results';
import { istDate, longDate } from '@/lib/ist';
import type { Prisma } from '@/generated/prisma/client';
import type { SessionUser } from './auth/session';

const num = (d: Prisma.Decimal | null | undefined): number | null => (d === null || d === undefined ? null : d.toNumber());

// ───────── what an order is expected to report ─────────

const paramSelect = { include: { ranges: true } } satisfies Prisma.ParameterDefaultArgs;
type ParamRow = Prisma.ParameterGetPayload<typeof paramSelect>;

interface Expected {
  /** Tests in order, with the parameters each one reports (de-duplicated across the order). */
  tests: (ReportTestInput & { testId: string })[];
  params: Map<string, ParamRow>;
}

async function expectedFor(orderId: string): Promise<Expected> {
  const items = await db.orderItem.findMany({
    where: { orderId },
    orderBy: { id: 'asc' },
    include: { test: { include: { parameters: { orderBy: { position: 'asc' }, include: { parameter: paramSelect } } } } },
  });
  const params = new Map<string, ParamRow>();
  const seen = new Set<string>();
  const tests = items.map((it) => ({
    testId: it.testId,
    id: it.testId,
    name: it.name,
    parameters: it.test.parameters
      .filter((tp) => !seen.has(tp.parameterId) && !!seen.add(tp.parameterId))
      .map((tp) => {
        params.set(tp.parameterId, tp.parameter);
        return { parameterId: tp.parameterId, name: tp.parameter.name, groupName: tp.groupName };
      }),
  }));
  return { tests, params };
}

const rules = (p: ParamRow): RangeRule[] => p.ranges.map((r) => ({ sex: r.sex, ageMin: r.ageMin, ageMax: r.ageMax, low: r.low.toNumber(), high: r.high.toNumber() }));

// ───────── technician: result entry ─────────

export interface EntryRow {
  parameterId: string;
  name: string;
  testName: string;
  groupName: string | null;
  kind: 'NUMERIC' | 'CHOICE' | 'TEXT';
  unit: string;
  options: string[];
  /** The range that will apply to this patient, as text. */
  range: string | null;
  value: string;
  abnormal: boolean;
  /** Set once a value is saved. Decided by the server, shown here for review. */
  flag: 'NORMAL' | 'HIGH' | 'LOW' | 'ABNORMAL' | null;
}

export interface EntryForm {
  order: { id: string; code: string; status: string; patientName: string; patientAge: number; patientGender: 'MALE' | 'FEMALE' | 'OTHER' };
  rows: EntryRow[];
}

const ENTRY_STATES = ['SAMPLE_COLLECTED', 'PROCESSING'] as const;

export async function getEntryForm(code: string): Promise<EntryForm> {
  const order = await db.order.findUnique({ where: { code } });
  if (!order) throw new ApiError(404, 'not_found', 'Order not found.');
  const [{ tests, params }, existing] = await Promise.all([expectedFor(order.id), db.result.findMany({ where: { orderId: order.id } })]);
  const have = new Map(existing.map((r) => [r.parameterId, r]));
  const sex = order.patientGender;
  const rows: EntryRow[] = tests.flatMap((t) =>
    t.parameters.map((tp) => {
      const p = params.get(tp.parameterId)!;
      const r = have.get(tp.parameterId);
      const { low, high } = pickRange({ low: num(p.refLow), high: num(p.refHigh) }, rules(p), { sex, age: order.patientAge });
      return {
        parameterId: p.id,
        name: p.name,
        testName: t.name,
        groupName: tp.groupName,
        kind: p.kind,
        unit: p.unit,
        options: p.options,
        range: p.kind === 'NUMERIC' ? rangeText(low, high, p.decimals, null) : p.refText,
        value: r ? (r.valueNum !== null ? r.valueNum.toFixed(r.decimals) : (r.valueText ?? '')) : '',
        abnormal: r?.flag === 'ABNORMAL',
        flag: r?.flag ?? null,
      };
    }),
  );
  return { order: { id: order.id, code: order.code, status: order.status, patientName: order.patientName, patientAge: order.patientAge, patientGender: order.patientGender }, rows };
}

export interface EntryInput {
  parameterId: string;
  /** Raw text from the form. Empty means "not entered yet". */
  value: string;
  /** For free-text results: the reviewer marks it abnormal. */
  abnormal?: boolean;
}

/**
 * Save result values. The server parses the number, rounds it to the parameter's decimals,
 * picks the range for this patient's age and sex, and sets the flag. Whoever types the number
 * cannot choose the flag.
 */
export async function saveResults(user: SessionUser, code: string, entries: EntryInput[]): Promise<{ saved: number }> {
  const order = await db.order.findUnique({ where: { code } });
  if (!order) throw new ApiError(404, 'not_found', 'Order not found.');
  if (!(ENTRY_STATES as readonly string[]).includes(order.status)) {
    throw new ApiError(409, 'wrong_state', order.status === 'REPORT_READY' ? 'This report has been released. Ask an admin to reopen it to make a correction.' : 'Results can be entered once the sample is collected.');
  }
  const { params } = await expectedFor(order.id);
  const patient = { sex: order.patientGender, age: order.patientAge };

  const toSave: Prisma.ResultUncheckedCreateInput[] = [];
  for (const e of entries) {
    const value = e.value.trim();
    if (!value) continue;
    const p = params.get(e.parameterId);
    if (!p) throw new ApiError(400, 'invalid_parameter', 'One of the results is not part of this order.');
    const base = { orderId: order.id, parameterId: p.id, unit: p.unit, decimals: p.decimals, enteredById: user.id, enteredAt: new Date(), verifiedById: null, verifiedAt: null };
    if (p.kind === 'NUMERIC') {
      if (!/^\d+(\.\d+)?$/.test(value) || Number(value) > 1_000_000) throw new ApiError(400, 'invalid_value', `“${p.name}” must be a number, like 14.2.`);
      const ev = evaluateNumeric(Number(value), { decimals: p.decimals, refLow: num(p.refLow), refHigh: num(p.refHigh) }, rules(p), patient);
      toSave.push({ ...base, valueNum: ev.value, valueText: null, flag: ev.flag, refLow: ev.low, refHigh: ev.high, refText: null });
    } else if (p.kind === 'CHOICE') {
      if (!p.options.includes(value)) throw new ApiError(400, 'invalid_value', `“${p.name}” must be one of: ${p.options.join(', ')}.`);
      toSave.push({ ...base, valueNum: null, valueText: value, flag: value === p.refText ? 'NORMAL' : 'ABNORMAL', refLow: null, refHigh: null, refText: p.refText });
    } else {
      if (value.length > 2000) throw new ApiError(400, 'invalid_value', `“${p.name}” is too long (2000 characters at most).`);
      toSave.push({ ...base, valueNum: null, valueText: value, flag: e.abnormal ? 'ABNORMAL' : 'NORMAL', refLow: null, refHigh: null, refText: null });
    }
  }
  if (!toSave.length) return { saved: 0 };

  await db.$transaction(async (tx) => {
    for (const r of toSave) {
      const { orderId, parameterId, ...data } = r;
      await tx.result.upsert({ where: { orderId_parameterId: { orderId, parameterId } }, create: r, update: data });
    }
    // Conditional, so a report released a moment ago isn't dragged back by a late save.
    const moved = await tx.order.updateMany({ where: { id: order.id, status: { in: ['SAMPLE_COLLECTED', 'PROCESSING'] } }, data: { status: 'PROCESSING' } });
    if (moved.count === 0) throw new ApiError(409, 'wrong_state', 'This order changed while you were saving. Please reload.');
    await audit(tx, { actorId: user.id, action: 'result.save', entity: 'Order', entityId: order.id, meta: { count: toSave.length } });
  });
  return { saved: toSave.length };
}

// ───────── pathologist: verify and release ─────────

export async function releaseReport(user: SessionUser, code: string): Promise<{ reportId: string }> {
  const order = await db.order.findUnique({ where: { code } });
  if (!order) throw new ApiError(404, 'not_found', 'Order not found.');
  if (order.status !== 'PROCESSING') throw new ApiError(409, 'wrong_state', order.status === 'REPORT_READY' ? 'This report has already been released.' : 'Results must be entered before a report can be released.');

  const { tests, params } = await expectedFor(order.id);
  const results = await db.result.findMany({ where: { orderId: order.id } });
  const missing = [...params.keys()].filter((id) => !results.some((r) => r.parameterId === id));
  if (missing.length) throw new ApiError(409, 'incomplete', `${missing.length} result${missing.length === 1 ? ' is' : 's are'} still missing. Every result must be entered before release.`, { missing: missing.length });

  const settings = await loadSettings();
  const releasedAt = new Date();
  const report = await composeReport(order, tests, results, releasedAt, user.name);
  const pdf = await renderReportPdf(report, { phone: settings.phone, pathologistTitle: settings.pathologistTitle });
  const key = `reports/${order.id}/report.pdf`;
  await storage().put(key, pdf, 'application/pdf');

  const row = await db.$transaction(async (tx) => {
    const moved = await tx.order.updateMany({ where: { id: order.id, status: 'PROCESSING' }, data: { status: 'REPORT_READY' } });
    if (moved.count === 0) throw new ApiError(409, 'wrong_state', 'This report has already been released.');
    await tx.result.updateMany({ where: { orderId: order.id }, data: { verifiedById: user.id, verifiedAt: releasedAt } });
    const r = await tx.report.create({ data: { orderId: order.id, pdfKey: key, releasedAt, releasedById: user.id, pathologistName: user.name } });
    await audit(tx, { actorId: user.id, action: 'report.release', entity: 'Order', entityId: order.id, meta: { code: order.code } });
    return r;
  });
  await notifyOrder(order.id, 'report_ready');
  return { reportId: row.id };
}

/** Admin-only escape hatch for fixing a released report: back to Processing, report removed, with a reason on record. */
export async function reopenReport(user: SessionUser, code: string, reason: string): Promise<void> {
  const order = await db.order.findUnique({ where: { code }, include: { report: true } });
  if (!order) throw new ApiError(404, 'not_found', 'Order not found.');
  if (order.status !== 'REPORT_READY' || !order.report) throw new ApiError(409, 'wrong_state', 'Only a released report can be reopened.');
  await db.$transaction(async (tx) => {
    await tx.report.delete({ where: { id: order.report!.id } });
    await tx.result.updateMany({ where: { orderId: order.id }, data: { verifiedById: null, verifiedAt: null } });
    await tx.order.update({ where: { id: order.id }, data: { status: 'PROCESSING' } });
    await audit(tx, { actorId: user.id, action: 'report.reopen', entity: 'Order', entityId: order.id, meta: { code: order.code, reason: reason.slice(0, 200) } });
  });
  if (order.report.pdfKey) await storage().delete(order.report.pdfKey).catch(() => undefined);
}

// ───────── reading a released report ─────────

type OrderRow = Prisma.OrderGetPayload<object>;

async function composeReport(order: OrderRow, tests: ReportTestInput[], results: Prisma.ResultGetPayload<object>[], releasedAt: Date, verifiedBy: string): Promise<ReportDTO> {
  const sample = await db.sample.findFirst({ where: { orderId: order.id }, orderBy: { collectedAt: 'asc' } });
  const collected = sample
    ? sample.collectedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
    : `${longDate(istDate(order.slotDate))}, ${order.slotLabel}`;
  const map = new Map<string, StoredResult>(
    results.map((r) => [r.parameterId, { parameterId: r.parameterId, valueNum: num(r.valueNum), valueText: r.valueText, flag: r.flag, unit: r.unit, refLow: num(r.refLow), refHigh: num(r.refHigh), refText: r.refText, decimals: r.decimals }]),
  );
  return buildReport({ order, collected, releasedAt, verifiedBy, tests, results: map });
}

async function loadReportFor(user: SessionUser, code: string) {
  const order = await db.order.findUnique({ where: { code }, include: { report: true } });
  // Someone else's order and a missing one look the same.
  if (!order || (order.userId !== user.id && user.role === 'PATIENT')) throw new ApiError(404, 'not_found', 'We could not find that report.');
  if (order.status !== 'REPORT_READY' || !order.report) throw new ApiError(404, 'not_ready', 'This report is not ready yet.');
  return { order, report: order.report };
}

/** The structured report for the web view. Opening it is recorded. */
export async function getReport(user: SessionUser, code: string): Promise<ReportDTO> {
  const { order, report } = await loadReportFor(user, code);
  const { tests } = await expectedFor(order.id);
  const results = await db.result.findMany({ where: { orderId: order.id } });
  await audit(null, { actorId: user.id, action: 'report.view', entity: 'Order', entityId: order.id });
  return composeReport(order, tests, results, report.releasedAt, report.pathologistName);
}

/** The PDF bytes. Served from storage; rebuilt from the stored results if the file has gone missing. */
export async function getReportPdf(user: SessionUser, code: string): Promise<Buffer> {
  const { order, report } = await loadReportFor(user, code);
  await audit(null, { actorId: user.id, action: 'report.download', entity: 'Order', entityId: order.id });
  const hit = report.pdfKey ? await storage().get(report.pdfKey) : null;
  if (hit) return hit.data;
  const { tests } = await expectedFor(order.id);
  const results = await db.result.findMany({ where: { orderId: order.id } });
  const settings = await loadSettings();
  const pdf = await renderReportPdf(await composeReport(order, tests, results, report.releasedAt, report.pathologistName), { phone: settings.phone, pathologistTitle: settings.pathologistTitle });
  const key = `reports/${order.id}/report.pdf`;
  await storage().put(key, pdf, 'application/pdf');
  await db.report.update({ where: { id: report.id }, data: { pdfKey: key } });
  return pdf;
}

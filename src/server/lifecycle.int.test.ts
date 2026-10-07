import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../test/db';
import { db } from './db';
import { createOrder } from './orders';
import { collectSample } from './samples';
import { getEntryForm, getReport, getReportPdf, releaseReport, reopenReport, saveResults } from './results';
import { bookableDates } from '@/lib/ist';
import type { SessionUser } from './auth/session';

const user = (u: { id: string; name: string; phone: string }, role: SessionUser['role']): SessionUser => ({ ...u, role });
let patient: SessionUser, other: SessionUser, phleb: SessionUser, tech: SessionUser, path: SessionUser, admin: SessionUser;

async function bookCbc(over: { gender?: 'MALE' | 'FEMALE'; age?: number; items?: string[]; total?: number } = {}) {
  return createOrder(patient, {
    items: over.items ?? ['thyt'], coupon: null, hardCopy: false,
    patient: { name: 'Lakshmi Rao', age: over.age ?? 34, gender: over.gender ?? 'FEMALE' },
    address: { line: '12, 4th Cross, Indiranagar', pincode: '560038' }, city: 'Bengaluru',
    slot: { date: bookableDates(5)[0]!, slotId: 's1000' }, payMode: 'COD', expectedTotal: over.total ?? 539, idempotencyKey: crypto.randomUUID(),
  });
}

async function fill(code: string, who: SessionUser, values: Record<string, string>) {
  const form = await getEntryForm(code);
  const entries = form.rows.filter((r) => r.name in values).map((r) => ({ parameterId: r.parameterId, value: values[r.name]! }));
  return saveResults(who, code, entries);
}

beforeEach(async () => {
  await resetDb();
  const mk = async (phone: string, name: string, role: SessionUser['role']) => user(await db.user.create({ data: { phone, name, role } }), role);
  patient = await mk('9876500001', 'Lakshmi Rao', 'PATIENT');
  other = await mk('9876500002', 'Someone Else', 'PATIENT');
  phleb = await mk('9876500003', 'Ravi Phlebotomist', 'PHLEBOTOMIST');
  tech = await mk('9876500004', 'Tara Technician', 'TECHNICIAN');
  path = await mk('9876500005', 'Dr Priya Pathologist', 'PATHOLOGIST');
  admin = await mk('9876500006', 'Admin', 'ADMIN');
});

describe('the whole journey: booked → collected → processing → released → read by the patient', () => {
  it('walks the four stages and the patient reads a flagged report', async () => {
    const o = await bookCbc();
    expect(o.status).toBe('BOOKED');

    const { barcode } = await collectSample(phleb, o.code, { paymentCollected: true });
    expect(barcode).toBe(`S-${o.code}-1`);
    let row = await db.order.findUniqueOrThrow({ where: { code: o.code } });
    expect(row).toMatchObject({ status: 'SAMPLE_COLLECTED', paymentStatus: 'PAID' });

    // TSH 5.5 is above 4.2 → High; T3 and T4 normal
    await fill(o.code, tech, { 'T3, total': '112', 'T4, total': '8.6', TSH: '5.5' });
    expect((await db.order.findUniqueOrThrow({ where: { code: o.code } })).status).toBe('PROCESSING');

    await expect(getReport(patient, o.code)).rejects.toMatchObject({ code: 'not_ready' }); // nothing visible before release
    await releaseReport(path, o.code);
    row = await db.order.findUniqueOrThrow({ where: { code: o.code } });
    expect(row.status).toBe('REPORT_READY');

    const r = await getReport(patient, o.code);
    const rows = r.tests.flatMap((t) => t.groups.flatMap((g) => g.rows));
    expect(rows.map((x) => [x.name, x.value, x.flag])).toEqual([['T3, total', '112', 'NORMAL'], ['T4, total', '8.6', 'NORMAL'], ['TSH', '5.50', 'HIGH']]);
    expect(rows.find((x) => x.name === 'TSH')).toMatchObject({ unit: 'µIU/mL', range: '0.27 – 4.2' });
    expect(r.summary).toEqual({ within: 2, outside: 1 });
    expect(r.verifiedBy).toBe('Dr Priya Pathologist');
    expect((await db.result.findMany()).every((x) => x.verifiedById === path.id)).toBe(true);
  });

  it('produces a real PDF, from storage, and rebuilds it if the file is gone', async () => {
    const o = await bookCbc();
    await collectSample(phleb, o.code);
    await fill(o.code, tech, { 'T3, total': '112', 'T4, total': '8.6', TSH: '2.1' });
    await releaseReport(path, o.code);
    const pdf = await getReportPdf(patient, o.code);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(4000);

    const rep = await db.report.findFirstOrThrow();
    const { storage } = await import('./storage');
    await storage().delete(rep.pdfKey!);
    expect((await getReportPdf(patient, o.code)).subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('flags are decided by the server, for this patient', () => {
  it('rounds before flagging and refuses non-numbers', async () => {
    const o = await bookCbc();
    await collectSample(phleb, o.code);
    await fill(o.code, tech, { TSH: '4.204' }); // 2 decimals → 4.20, which is the upper limit: still normal
    expect((await db.result.findFirstOrThrow()).flag).toBe('NORMAL');
    await expect(fill(o.code, tech, { TSH: 'high' })).rejects.toMatchObject({ code: 'invalid_value' });
    await expect(fill(o.code, tech, { TSH: '-1' })).rejects.toMatchObject({ code: 'invalid_value' });
    await expect(fill(o.code, tech, { TSH: '1e9' })).rejects.toMatchObject({ code: 'invalid_value' });
  });

  it('uses the sex-specific range once the lab has supplied one', async () => {
    const hb = await db.parameter.findUniqueOrThrow({ where: { name: 'Hemoglobin' } });
    await db.referenceRange.create({ data: { parameterId: hb.id, sex: 'FEMALE', low: 12, high: 15.5 } });
    const o = await bookCbc({ items: ['cbc'], total: 299 + 99 });
    await collectSample(phleb, o.code);
    await fill(o.code, tech, { Hemoglobin: '12.4' }); // low for a man (13–17), normal for this woman (12–15.5)
    expect((await db.result.findFirstOrThrow()).flag).toBe('NORMAL');
    await db.referenceRange.deleteMany();
  });

  it('keeps the range and unit that applied at the time, even if the lab edits them later', async () => {
    const o = await bookCbc();
    await collectSample(phleb, o.code);
    await fill(o.code, tech, { 'T3, total': '112', 'T4, total': '8.6', TSH: '2.1' });
    await db.parameter.update({ where: { name: 'TSH' }, data: { refHigh: 1, unit: 'changed' } });
    await releaseReport(path, o.code);
    const tsh = (await getReport(patient, o.code)).tests[0]!.groups[0]!.rows.find((r) => r.name === 'TSH')!;
    expect(tsh).toMatchObject({ unit: 'µIU/mL', range: '0.27 – 4.2', flag: 'NORMAL' });
    await db.parameter.update({ where: { name: 'TSH' }, data: { refHigh: 4.2, unit: 'µIU/mL' } });
  });

  it('handles Negative/Positive and free-text results', async () => {
    const o = await bookCbc({ items: ['ns1', 'ecg'], total: 599 + 299 });
    await collectSample(phleb, o.code);
    const form = await getEntryForm(o.code);
    const ns1 = form.rows.find((r) => r.name.startsWith('Dengue'))!;
    const ecg = form.rows.find((r) => r.name.startsWith('ECG'))!;
    expect(ns1.options).toEqual(['Negative', 'Positive']);
    await expect(saveResults(tech, o.code, [{ parameterId: ns1.parameterId, value: 'Maybe' }])).rejects.toMatchObject({ code: 'invalid_value' });
    await saveResults(tech, o.code, [{ parameterId: ns1.parameterId, value: 'Positive' }, { parameterId: ecg.parameterId, value: 'Sinus rhythm. No acute changes.', abnormal: false }]);
    const flags = Object.fromEntries((await db.result.findMany({ include: { parameter: true } })).map((r) => [r.parameter.name.slice(0, 5), r.flag]));
    expect(flags).toEqual({ 'Dengu': 'ABNORMAL', 'ECG (': 'NORMAL' });
  });
});

describe('guards on the workflow', () => {
  it('cannot collect twice, cannot enter results before collection, cannot release incomplete', async () => {
    const o = await bookCbc();
    await expect(fill(o.code, tech, { TSH: '2' })).rejects.toMatchObject({ code: 'wrong_state' });
    await collectSample(phleb, o.code);
    await expect(collectSample(phleb, o.code)).rejects.toMatchObject({ code: 'wrong_state' });
    await expect(releaseReport(path, o.code)).rejects.toMatchObject({ code: 'wrong_state' });
    await fill(o.code, tech, { TSH: '2' });
    await expect(releaseReport(path, o.code)).rejects.toMatchObject({ code: 'incomplete', extra: { missing: 2 } });
  });

  it('a phlebotomist cannot take someone else\'s pickup; duplicate barcodes are refused', async () => {
    const a = await bookCbc();
    await db.order.update({ where: { code: a.code }, data: { assignedToId: admin.id } });
    await expect(collectSample(phleb, a.code)).rejects.toMatchObject({ status: 403 });
    await collectSample(admin, a.code, { barcode: 'TUBE-0001' });
    const b = await bookCbc();
    await expect(collectSample(phleb, b.code, { barcode: 'TUBE-0001' })).rejects.toMatchObject({ code: 'barcode_used' });
    await expect(collectSample(phleb, b.code, { barcode: 'x y' })).rejects.toMatchObject({ code: 'invalid_barcode' });
    expect((await db.order.findUniqueOrThrow({ where: { code: b.code } })).status).toBe('BOOKED'); // failed attempts change nothing
  });

  it('releasing twice at once publishes once', async () => {
    const o = await bookCbc();
    await collectSample(phleb, o.code);
    await fill(o.code, tech, { 'T3, total': '112', 'T4, total': '8.6', TSH: '2.1' });
    const r = await Promise.allSettled([releaseReport(path, o.code), releaseReport(path, o.code)]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(await db.report.count()).toBe(1);
  });

  it('a released report cannot be edited; an admin can reopen it with a reason on record', async () => {
    const o = await bookCbc();
    await collectSample(phleb, o.code);
    await fill(o.code, tech, { 'T3, total': '112', 'T4, total': '8.6', TSH: '2.1' });
    await releaseReport(path, o.code);
    await expect(fill(o.code, tech, { TSH: '9' })).rejects.toMatchObject({ code: 'wrong_state' });
    await reopenReport(admin, o.code, 'Typo in TSH');
    expect((await db.order.findUniqueOrThrow({ where: { code: o.code } })).status).toBe('PROCESSING');
    await expect(getReport(patient, o.code)).rejects.toMatchObject({ code: 'not_ready' });
    const log = await db.auditLog.findFirstOrThrow({ where: { action: 'report.reopen' } });
    expect(log).toMatchObject({ actorId: admin.id });
    expect((log.meta as { reason: string }).reason).toBe('Typo in TSH');
  });
});

describe('privacy of reports', () => {
  async function released() {
    const o = await bookCbc();
    await collectSample(phleb, o.code);
    await fill(o.code, tech, { 'T3, total': '112', 'T4, total': '8.6', TSH: '2.1' });
    await releaseReport(path, o.code);
    return o;
  }

  it("another patient gets 'not found' for the report and the PDF, exactly as for a code that doesn't exist", async () => {
    const o = await released();
    await expect(getReport(other, o.code)).rejects.toMatchObject({ status: 404, code: 'not_found' });
    await expect(getReportPdf(other, o.code)).rejects.toMatchObject({ status: 404, code: 'not_found' });
    await expect(getReport(other, 'AL-ZZZZZZ')).rejects.toMatchObject({ status: 404, code: 'not_found' });
  });

  it('records who opened and downloaded a report, without storing any values', async () => {
    const o = await released();
    await getReport(patient, o.code);
    await getReportPdf(patient, o.code);
    await getReport(admin, o.code);
    const logs = await db.auditLog.findMany({ where: { action: { in: ['report.view', 'report.download'] } }, orderBy: { at: 'asc' } });
    expect(logs.map((l) => [l.action, l.actorId])).toEqual([['report.view', patient.id], ['report.download', patient.id], ['report.view', admin.id]]);
    expect(JSON.stringify(logs)).not.toMatch(/112|8\.6|2\.1/);
  });

  it('audit entries for results record counts only', async () => {
    await released();
    const log = await db.auditLog.findFirstOrThrow({ where: { action: 'result.save' } });
    expect(log.meta).toEqual({ count: 3 });
  });
});

describe('who may read results and released reports besides the owner', () => {
  it('pathologists, technicians and admins can; phlebotomists and other patients cannot', async () => {
    const o = await bookCbc();
    await collectSample(phleb, o.code);
    await fill(o.code, tech, { 'T3, total': '112', 'T4, total': '8.6', TSH: '2.1' });
    await releaseReport(path, o.code);
    for (const who of [path, tech, admin]) {
      await expect(getReport(who, o.code)).resolves.toBeTruthy();
      expect((await getReportPdf(who, o.code)).subarray(0, 5).toString()).toBe('%PDF-');
    }
    // a phlebotomist collects samples; reading patients' results is not part of that job
    await expect(getReport(phleb, o.code)).rejects.toMatchObject({ status: 404, code: 'not_found' });
    await expect(getReportPdf(phleb, o.code)).rejects.toMatchObject({ status: 404, code: 'not_found' });
    await expect(getReport(other, o.code)).rejects.toMatchObject({ status: 404 });
  });

  it('a phlebotomist who is also a patient can still read their own report', async () => {
    const o = await createOrder(phleb, {
      items: ['thyt'], coupon: null, hardCopy: false, patient: { name: 'Ravi', age: 40, gender: 'MALE' }, address: { line: '12, 4th Cross, Indiranagar', pincode: '560038' }, city: 'Bengaluru',
      slot: { date: bookableDates(5)[1]!, slotId: 's1000' }, payMode: 'COD', expectedTotal: 539, idempotencyKey: crypto.randomUUID(),
    });
    await collectSample(admin, o.code);
    await fill(o.code, tech, { 'T3, total': '112', 'T4, total': '8.6', TSH: '2.1' });
    await releaseReport(path, o.code);
    await expect(getReport(phleb, o.code)).resolves.toBeTruthy();
  });
});

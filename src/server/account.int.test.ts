import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../test/db';
import { db } from './db';
import { createOrder } from './orders';
import { collectSample } from './samples';
import { releaseReport, saveResults, getEntryForm } from './results';
import { exportMyData, getSavedDetails, removeAddress, removePatient, requestDeletion } from './account';
import { bookableDates } from '@/lib/ist';
import type { SessionUser } from './auth/session';

let me: SessionUser, other: SessionUser, staff: SessionUser;
const book = (u: SessionUser, d = 0) => createOrder(u, {
  items: ['thyt'], coupon: null, hardCopy: false, patient: { name: u.name, age: 34, gender: 'FEMALE' }, address: { line: '12, 4th Cross, Indiranagar', pincode: '560038' },
  city: 'Bengaluru', slot: { date: bookableDates(5)[d]!, slotId: 's1000' }, payMode: 'COD', expectedTotal: 539, idempotencyKey: crypto.randomUUID(),
});

beforeEach(async () => {
  await resetDb();
  const mk = async (phone: string, name: string, role: SessionUser['role'] = 'PATIENT') => { const u = await db.user.create({ data: { phone, name, role } }); return { id: u.id, name, phone, role } as SessionUser; };
  me = await mk('9876500001', 'Lakshmi Rao'); other = await mk('9876500002', 'Someone Else'); staff = await mk('9876500009', 'Staff Admin', 'ADMIN');
});

describe('saved details', () => {
  it('lists only your own, and removing one hides it without touching past orders', async () => {
    const o = await book(me);
    await book(other, 1);
    const saved = await getSavedDetails(me.id);
    expect(saved.patients).toHaveLength(1);
    await removePatient(me.id, saved.patients[0]!.id);
    await removeAddress(me.id, saved.addresses[0]!.id);
    expect(await getSavedDetails(me.id)).toEqual({ patients: [], addresses: [] });
    expect((await getSavedDetails(other.id)).patients).toHaveLength(1);
    expect((await db.order.findUniqueOrThrow({ where: { code: o.code } })).patientName).toBe('Lakshmi Rao'); // the order keeps its own copy
  });

  it("cannot remove someone else's saved details", async () => {
    await book(other);
    const theirs = (await getSavedDetails(other.id)).patients[0]!;
    await expect(removePatient(me.id, theirs.id)).rejects.toMatchObject({ status: 404 });
    expect((await getSavedDetails(other.id)).patients).toHaveLength(1);
  });
});

describe('data export', () => {
  it('includes your orders, and results only after the pathologist has released them', async () => {
    const o = await book(me);
    let x = await exportMyData(me.id);
    expect(x.orders[0]).toMatchObject({ code: o.code, results: [], report: null });

    await collectSample({ ...staff, role: 'PHLEBOTOMIST' }, o.code);
    const form = await getEntryForm(o.code);
    await saveResults({ ...staff, role: 'TECHNICIAN' }, o.code, form.rows.map((r) => ({ parameterId: r.parameterId, value: r.name === 'TSH' ? '5.5' : '100' })));
    x = await exportMyData(me.id);
    expect(x.orders[0]!.results).toEqual([]); // entered but not verified: not shown yet

    await releaseReport({ ...staff, role: 'PATHOLOGIST' }, o.code);
    x = await exportMyData(me.id);
    expect(x.orders[0]!.results.find((r) => r.parameter === 'TSH')).toMatchObject({ value: '5.50', flag: 'HIGH' });
    expect(x.orders[0]!.report).toBeTruthy();
  });

  it("never contains another person's data, and the export itself is audited", async () => {
    await book(other);
    const o = await book(me, 1);
    const x = await exportMyData(me.id);
    expect(x.orders.map((r) => r.code)).toEqual([o.code]);
    expect(JSON.stringify(x)).not.toContain('Someone Else');
    expect(await db.auditLog.count({ where: { action: 'account.export', actorId: me.id } })).toBe(1);
  });
});

describe('deletion request', () => {
  it('goes to the admin inbox once, not repeatedly', async () => {
    await requestDeletion(me);
    await requestDeletion(me);
    const rows = await db.callbackRequest.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: me.id, status: 'NEW' });
    expect(rows[0]!.note).toMatch(/^ACCOUNT DELETION REQUEST/);
  });
});

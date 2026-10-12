import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { jar, mockNextHeaders } from '../../test/next-mocks';
import { resetDb } from '../../test/db';
import { db } from './db';
import { createSession } from './auth/session';
import { sessionCookieName } from './auth/cookie';
import type { Role } from '@/generated/prisma/enums';

import * as collect from '../app/api/staff/orders/[code]/collect/route';
import * as results from '../app/api/staff/orders/[code]/results/route';
import * as release from '../app/api/staff/orders/[code]/release/route';
import * as reopen from '../app/api/staff/orders/[code]/reopen/route';
import * as assign from '../app/api/staff/orders/[code]/assign/route';
import * as cancelAdmin from '../app/api/staff/orders/[code]/cancel/route';
import * as adminTests from '../app/api/admin/tests/route';
import * as adminTest from '../app/api/admin/tests/[id]/route';
import * as adminSettings from '../app/api/admin/settings/route';
import * as adminStaff from '../app/api/admin/staff/route';
import * as adminUser from '../app/api/admin/users/[id]/route';
import * as adminCoupons from '../app/api/admin/coupons/route';
import * as adminSlot from '../app/api/admin/slots/[id]/route';
import * as adminParam from '../app/api/admin/parameters/route';
import * as adminCallback from '../app/api/admin/callbacks/[id]/route';
import * as ordersList from '../app/api/orders/route';

mockNextHeaders();

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
const ROLES: (Role | 'NONE')[] = ['NONE', 'PATIENT', 'PHLEBOTOMIST', 'TECHNICIAN', 'PATHOLOGIST', 'ADMIN'];

// [label, handler, method, params, who may call it]. Admin can call everything.
const MATRIX: [string, Handler | undefined, string, Record<string, string>, Role[]][] = [
  ['collect sample', collect.POST as Handler, 'POST', { code: 'AL-AAAAAA' }, ['PHLEBOTOMIST']],
  ['enter results', results.PUT as Handler, 'PUT', { code: 'AL-AAAAAA' }, ['TECHNICIAN']],
  ['release report', release.POST as Handler, 'POST', { code: 'AL-AAAAAA' }, ['PATHOLOGIST']],
  ['reopen report', reopen.POST as Handler, 'POST', { code: 'AL-AAAAAA' }, []],
  ['assign phlebotomist', assign.POST as Handler, 'POST', { code: 'AL-AAAAAA' }, []],
  ['admin cancel', cancelAdmin.POST as Handler, 'POST', { code: 'AL-AAAAAA' }, []],
  ['create test', adminTests.POST as Handler, 'POST', {}, []],
  ['edit test', adminTest.PATCH as Handler, 'PATCH', { id: 'cbc' }, []],
  ['edit settings', adminSettings.PUT as Handler, 'PUT', {}, []],
  ['add staff', adminStaff.POST as Handler, 'POST', {}, []],
  ['disable user', adminUser.PATCH as Handler, 'PATCH', { id: 'x' }, []],
  ['create coupon', adminCoupons.POST as Handler, 'POST', {}, []],
  ['edit slot', adminSlot.PATCH as Handler, 'PATCH', { id: 's1000' }, []],
  ['create parameter', adminParam.POST as Handler, 'POST', {}, []],
  ['update callback', adminCallback.PATCH as Handler, 'PATCH', { id: 'x' }, []],
];

const users = new Map<Role, { id: string; token: string }>();

async function actAs(role: Role | 'NONE') {
  jar.clear();
  if (role === 'NONE') return;
  const u = users.get(role)!;
  jar.set(sessionCookieName(), { value: u.token, opts: {} });
}

beforeEach(async () => {
  await resetDb();
  users.clear();
  for (const [i, role] of (['PATIENT', 'PHLEBOTOMIST', 'TECHNICIAN', 'PATHOLOGIST', 'ADMIN'] as Role[]).entries()) {
    const u = await db.user.create({ data: { phone: `98000000${i}0`, name: `${role} person`, role } });
    users.set(role, { id: u.id, token: (await createSession(u.id, role)).token });
  }
});

const call = (h: Handler, method: string, params: Record<string, string>) =>
  h(new NextRequest('http://localhost:3000/api/x', { method, headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' }, body: '{}' }), { params: Promise.resolve(params) });

describe('role-based access: who may call which staff and admin endpoint', () => {
  for (const [label, handler, method, params, allowed] of MATRIX) {
    it(label, async () => {
      expect(handler, `${label} handler exported`).toBeTypeOf('function');
      for (const role of ROLES) {
        await actAs(role);
        const r = await call(handler!, method, params);
        const mayPass = role !== 'NONE' && (role === 'ADMIN' || allowed.includes(role as Role));
        if (role === 'NONE') expect(r.status, `${label} as logged out`).toBe(401);
        else if (!mayPass) expect(r.status, `${label} as ${role}`).toBe(403);
        else expect([401, 403], `${label} as ${role} must get past the role check (got ${r.status})`).not.toContain(r.status);
      }
    });
  }

  it('nothing changes when a forbidden role tries: a patient cannot edit a price', async () => {
    await actAs('PATIENT');
    const before = (await db.test.findUniqueOrThrow({ where: { id: 'cbc' } })).price;
    await adminTest.PATCH(new NextRequest('http://localhost:3000/api/admin/tests/cbc', { method: 'PATCH', headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' }, body: JSON.stringify({ price: 1 }) }), { params: Promise.resolve({ id: 'cbc' }) });
    expect((await db.test.findUniqueOrThrow({ where: { id: 'cbc' } })).price).toBe(before);
  });

  it('a disabled staff account is locked out at once, even with a live session', async () => {
    await actAs('ADMIN');
    const r1 = await call(adminSettings.PUT as Handler, 'PUT', {});
    expect([401, 403]).not.toContain(r1.status);
    await db.user.update({ where: { id: users.get('ADMIN')!.id }, data: { active: false } });
    expect((await call(adminSettings.PUT as Handler, 'PUT', {})).status).toBe(401);
  });

  it('staff endpoints refuse cross-site requests', async () => {
    await actAs('ADMIN');
    const r = await (adminSettings.PUT as Handler)(new NextRequest('http://localhost:3000/api/admin/settings', { method: 'PUT', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{}' }), { params: Promise.resolve({}) });
    expect(r.status).toBe(403);
  });

  it('listing orders only ever returns your own', async () => {
    const a = users.get('PATIENT')!;
    const b = await db.user.create({ data: { phone: '9811111111', name: 'Other', role: 'PATIENT' } });
    const slot = await db.slot.findFirstOrThrow();
    for (const [u, code] of [[a.id, 'AL-MINE22'], [b.id, 'AL-THEIRS']] as const) {
      await db.order.create({ data: { code, userId: u, patientName: 'X', patientAge: 30, patientGender: 'MALE', homeCollection: true, city: 'Bengaluru', slotDate: new Date('2030-01-01'), slotId: slot.id, slotLabel: slot.label, payMode: 'COD', mrpTotal: 100, priceTotal: 100, total: 100 } });
    }
    await actAs('PATIENT');
    const r = await (ordersList.GET as Handler)(new NextRequest('http://localhost:3000/api/orders'), { params: Promise.resolve({}) });
    expect((await r.json()).orders.map((o: { code: string }) => o.code)).toEqual(['AL-MINE22']);
  });
});

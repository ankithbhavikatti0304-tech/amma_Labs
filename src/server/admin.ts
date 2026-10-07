import 'server-only';
import { randomUUID } from 'node:crypto';
import { db } from './db';
import { audit } from './audit';
import { ApiError } from './http-errors';
import { invalidateCatalogue } from './catalogue';
import { revokeAllSessions } from './auth/session';
import { slugify } from '@/lib/slug';
import { LAB_DEFAULTS, type LabSettings } from '@/config/lab';
import type { Prisma } from '@/generated/prisma/client';
import type { Role, CallbackStatus, PrescriptionStatus, Gender } from '@/generated/prisma/enums';
import type { SessionUser } from './auth/session';

const notFound = (what: string) => new ApiError(404, 'not_found', `${what} not found.`);

// ───────── tests ─────────

export interface TestInput {
  name: string;
  isPackage: boolean;
  parameterCount: number | null;
  tatMinHours: number;
  tatMaxHours: number;
  price: number;
  mrp: number;
  fasting: boolean;
  morningSample: boolean;
  centreVisit: boolean;
  popular: boolean;
  active: boolean;
  includes: string[];
  categories: string[];
  mascot: string;
  mascotArg: string | null;
  tint: string;
}

async function checkCategories(ids: string[]) {
  const found = await db.category.count({ where: { id: { in: ids } } });
  if (found !== new Set(ids).size) throw new ApiError(400, 'invalid_input', 'Choose categories from the list.');
}

export async function createTest(admin: SessionUser, input: TestInput): Promise<{ id: string }> {
  await checkCategories(input.categories);
  let slug = slugify(input.name);
  if (!slug) throw new ApiError(400, 'invalid_input', 'Give the test a name.');
  if (await db.test.findUnique({ where: { slug } })) slug = `${slug}-${randomUUID().slice(0, 4)}`;
  const { categories, ...data } = input;
  const max = await db.test.aggregate({ _max: { sort: true } });
  const t = await db.test.create({
    data: { id: slug, slug, ...data, sort: (max._max.sort ?? 0) + 1, categories: { create: categories.map((categoryId, position) => ({ categoryId, position })) } },
    select: { id: true },
  });
  await audit(null, { actorId: admin.id, action: 'test.create', entity: 'Test', entityId: t.id });
  invalidateCatalogue();
  return t;
}

export async function updateTest(admin: SessionUser, id: string, input: TestInput): Promise<void> {
  const before = await db.test.findUnique({ where: { id } });
  if (!before) throw notFound('Test');
  await checkCategories(input.categories);
  const { categories, ...data } = input;
  await db.$transaction(async (tx) => {
    await tx.test.update({ where: { id }, data });
    await tx.testCategory.deleteMany({ where: { testId: id } });
    await tx.testCategory.createMany({ data: categories.map((categoryId, position) => ({ testId: id, categoryId, position })) });
    await audit(tx, { actorId: admin.id, action: 'test.update', entity: 'Test', entityId: id, meta: { price: [before.price, input.price], mrp: [before.mrp, input.mrp], active: [before.active, input.active] } });
  });
  invalidateCatalogue();
}

/** Which parameters a test reports, in order, with an optional section heading each. */
export async function setTestParameters(admin: SessionUser, id: string, items: { parameterId: string; groupName: string | null }[]): Promise<void> {
  if (!(await db.test.findUnique({ where: { id }, select: { id: true } }))) throw notFound('Test');
  const ids = items.map((i) => i.parameterId);
  if (new Set(ids).size !== ids.length) throw new ApiError(400, 'invalid_input', 'A parameter can only appear once in a test.');
  if ((await db.parameter.count({ where: { id: { in: ids } } })) !== ids.length) throw new ApiError(400, 'invalid_input', 'Choose parameters from the list.');
  await db.$transaction(async (tx) => {
    await tx.testParameter.deleteMany({ where: { testId: id } });
    await tx.testParameter.createMany({ data: items.map((i, position) => ({ testId: id, parameterId: i.parameterId, groupName: i.groupName, position })) });
    await audit(tx, { actorId: admin.id, action: 'test.parameters', entity: 'Test', entityId: id, meta: { count: items.length } });
  });
}

// ───────── parameters and reference ranges ─────────

export interface ParameterInput {
  name: string;
  kind: 'NUMERIC' | 'CHOICE' | 'TEXT';
  unit: string;
  refLow: number | null;
  refHigh: number | null;
  decimals: number;
  options: string[];
  refText: string | null;
}

function checkParameter(p: ParameterInput) {
  if (p.kind === 'NUMERIC' && p.refLow !== null && p.refHigh !== null && p.refLow > p.refHigh) throw new ApiError(400, 'invalid_input', 'The lower limit must be below the upper limit.');
  if (p.kind === 'CHOICE' && (p.options.length < 2 || !p.refText || !p.options.includes(p.refText))) throw new ApiError(400, 'invalid_input', 'Give at least two options, and pick which one is normal.');
}

export async function createParameter(admin: SessionUser, p: ParameterInput): Promise<{ id: string }> {
  checkParameter(p);
  if (await db.parameter.findUnique({ where: { name: p.name } })) throw new ApiError(409, 'duplicate', 'A parameter with that name already exists.');
  const row = await db.parameter.create({ data: p, select: { id: true } });
  await audit(null, { actorId: admin.id, action: 'parameter.create', entity: 'Parameter', entityId: row.id });
  return row;
}

/** Changing a range affects future results only: results already entered keep the range they were flagged against. */
export async function updateParameter(admin: SessionUser, id: string, p: ParameterInput): Promise<void> {
  checkParameter(p);
  const before = await db.parameter.findUnique({ where: { id } });
  if (!before) throw notFound('Parameter');
  const clash = await db.parameter.findFirst({ where: { name: p.name, NOT: { id } } });
  if (clash) throw new ApiError(409, 'duplicate', 'A parameter with that name already exists.');
  await db.parameter.update({ where: { id }, data: p });
  await audit(null, { actorId: admin.id, action: 'parameter.update', entity: 'Parameter', entityId: id });
}

export async function addRange(admin: SessionUser, parameterId: string, r: { sex: Gender | null; ageMin: number | null; ageMax: number | null; low: number; high: number }): Promise<void> {
  if (r.low > r.high) throw new ApiError(400, 'invalid_input', 'The lower limit must be below the upper limit.');
  if (r.ageMin !== null && r.ageMax !== null && r.ageMin > r.ageMax) throw new ApiError(400, 'invalid_input', 'Minimum age must not be above maximum age.');
  const p = await db.parameter.findUnique({ where: { id: parameterId } });
  if (!p || p.kind !== 'NUMERIC') throw new ApiError(400, 'invalid_input', 'Ranges apply to numeric parameters only.');
  await db.referenceRange.create({ data: { parameterId, ...r } });
  await audit(null, { actorId: admin.id, action: 'range.add', entity: 'Parameter', entityId: parameterId });
}

export async function deleteRange(admin: SessionUser, id: string): Promise<void> {
  const r = await db.referenceRange.findUnique({ where: { id } });
  if (!r) throw notFound('Range');
  await db.referenceRange.delete({ where: { id } });
  await audit(null, { actorId: admin.id, action: 'range.delete', entity: 'Parameter', entityId: r.parameterId });
}

// ───────── coupons ─────────

export interface CouponInput {
  code: string;
  description: string;
  type: 'PERCENT' | 'FLAT';
  value: number;
  cap: number | null;
  minOrder: number;
  active: boolean;
  maxUses: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
}

function checkCoupon(c: CouponInput) {
  if (c.type === 'PERCENT' && (c.value < 1 || c.value > 100)) throw new ApiError(400, 'invalid_input', 'A percentage coupon must be between 1 and 100.');
  if (c.startsAt && c.endsAt && c.startsAt >= c.endsAt) throw new ApiError(400, 'invalid_input', 'The end date must be after the start date.');
}

export async function createCoupon(admin: SessionUser, c: CouponInput): Promise<void> {
  checkCoupon(c);
  if (await db.coupon.findUnique({ where: { code: c.code } })) throw new ApiError(409, 'duplicate', 'That coupon code already exists.');
  await db.coupon.create({ data: c });
  await audit(null, { actorId: admin.id, action: 'coupon.create', entity: 'Coupon', entityId: c.code });
  invalidateCatalogue();
}

export async function updateCoupon(admin: SessionUser, code: string, c: Omit<CouponInput, 'code'>): Promise<void> {
  checkCoupon({ ...c, code });
  if (!(await db.coupon.findUnique({ where: { code } }))) throw notFound('Coupon');
  await db.coupon.update({ where: { code }, data: c });
  await audit(null, { actorId: admin.id, action: 'coupon.update', entity: 'Coupon', entityId: code });
  invalidateCatalogue();
}

// ───────── slots ─────────

export async function updateSlot(admin: SessionUser, id: string, s: { label: string; capacity: number; active: boolean; morning: boolean }): Promise<void> {
  if (!(await db.slot.findUnique({ where: { id } }))) throw notFound('Slot');
  await db.slot.update({ where: { id }, data: s });
  await audit(null, { actorId: admin.id, action: 'slot.update', entity: 'Slot', entityId: id, meta: { capacity: s.capacity, active: s.active } });
}

// ───────── staff ─────────

async function otherActiveAdmins(exceptId: string) {
  return db.user.count({ where: { role: 'ADMIN', active: true, NOT: { id: exceptId } } });
}

/** Add a staff member by phone, or change an existing person's role. They log in with the same OTP flow. */
export async function upsertStaff(admin: SessionUser, input: { phone: string; name: string; role: Role }): Promise<{ id: string }> {
  const existing = await db.user.findUnique({ where: { phone: input.phone } });
  if (existing && existing.role === 'ADMIN' && input.role !== 'ADMIN' && (await otherActiveAdmins(existing.id)) === 0) {
    throw new ApiError(409, 'last_admin', 'There must always be at least one active admin.');
  }
  const user = existing
    ? await db.user.update({ where: { id: existing.id }, data: { role: input.role, active: true } })
    : await db.user.create({ data: { phone: input.phone, name: input.name, role: input.role } });
  // Session lifetimes depend on role, so make them sign in again.
  if (existing && existing.role !== input.role) await revokeAllSessions(user.id);
  await audit(null, { actorId: admin.id, action: existing ? 'staff.role' : 'staff.create', entity: 'User', entityId: user.id, meta: { role: input.role } });
  return { id: user.id };
}

export async function setUserActive(admin: SessionUser, id: string, active: boolean): Promise<void> {
  const u = await db.user.findUnique({ where: { id } });
  if (!u) throw notFound('User');
  if (!active && u.role === 'ADMIN' && (await otherActiveAdmins(u.id)) === 0) throw new ApiError(409, 'last_admin', 'There must always be at least one active admin.');
  await db.user.update({ where: { id }, data: { active } });
  if (!active) await revokeAllSessions(id);
  await audit(null, { actorId: admin.id, action: active ? 'user.enable' : 'user.disable', entity: 'User', entityId: id });
}

// ───────── inbox ─────────

export async function updateCallback(admin: SessionUser, id: string, d: { status: CallbackStatus; note: string | null }): Promise<void> {
  if (!(await db.callbackRequest.findUnique({ where: { id } }))) throw notFound('Request');
  await db.callbackRequest.update({ where: { id }, data: { status: d.status, note: d.note, handledById: admin.id } });
}

export async function updatePrescription(admin: SessionUser, id: string, d: { status: PrescriptionStatus; note: string | null }): Promise<void> {
  if (!(await db.prescription.findUnique({ where: { id } }))) throw notFound('Prescription');
  await db.prescription.update({ where: { id }, data: { status: d.status, note: d.note, handledById: admin.id } });
  await audit(null, { actorId: admin.id, action: 'prescription.update', entity: 'Prescription', entityId: id, meta: { status: d.status } });
}

// ───────── settings ─────────

export async function updateSettings(admin: SessionUser, s: LabSettings): Promise<void> {
  const keys = Object.keys(LAB_DEFAULTS) as (keyof LabSettings)[];
  await db.$transaction(async (tx) => {
    for (const k of keys) {
      const value = s[k] as Prisma.InputJsonValue;
      await tx.setting.upsert({ where: { key: k }, create: { key: k, value }, update: { value } });
    }
    await audit(tx, { actorId: admin.id, action: 'settings.update', entity: 'Setting', entityId: 'lab' });
  });
  invalidateCatalogue();
}

import 'server-only';
import { z } from 'zod';
import { phoneSchema, personName } from './schemas';

// A blank required number must be an error, not a silent 0 (z.coerce.number() turns '' into 0).
const blankToUndefined = (v: unknown) => (v === '' ? undefined : v);
const int = (min: number, max: number) => z.preprocess(blankToUndefined, z.coerce.number({ message: 'Enter a number.' }).int('Whole numbers only.').min(min).max(max));
const money = z.preprocess(blankToUndefined, z.coerce.number({ message: 'Enter a number.' }).min(0).max(1_000_000));
const nullableInt = (min: number, max: number) => z.preprocess((v) => (v === '' || v === null || v === undefined ? null : v), z.coerce.number().int().min(min).max(max).nullable());
const nullableNum = z.preprocess((v) => (v === '' || v === null || v === undefined ? null : v), z.coerce.number().min(0).max(1_000_000).nullable());
const nullableText = (max: number) => z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().max(max).nullable());
const lines = (max: number) => z.preprocess((v) => (typeof v === 'string' ? v.split('\n').map((x) => x.trim()).filter(Boolean) : v), z.array(z.string().max(120)).max(max));
const text = (min: number, max: number) => z.string().trim().min(min).max(max);

export const testSchema = z
  .object({
    name: text(3, 140),
    isPackage: z.boolean(),
    parameterCount: nullableInt(1, 500),
    tatMinHours: int(1, 720),
    tatMaxHours: int(1, 720),
    price: int(0, 1_000_000),
    mrp: int(0, 1_000_000),
    fasting: z.boolean(),
    morningSample: z.boolean(),
    centreVisit: z.boolean(),
    popular: z.boolean(),
    active: z.boolean(),
    includes: lines(200),
    categories: z.array(z.string().max(30)).min(1, 'Pick at least one category.').max(12),
    mascot: text(1, 30),
    mascotArg: nullableText(30),
    tint: z.enum(['a', 'b', 'c']),
  })
  .refine((t) => t.tatMinHours <= t.tatMaxHours, { message: 'Fastest report time cannot be longer than the slowest.', path: ['tatMinHours'] })
  .refine((t) => t.mrp >= t.price, { message: 'MRP should not be below the selling price.', path: ['mrp'] });

export const testParametersSchema = z.object({ items: z.array(z.object({ parameterId: z.string().min(1).max(40), groupName: nullableText(80) })).max(300) });

export const parameterSchema = z.object({
  name: text(2, 100),
  kind: z.enum(['NUMERIC', 'CHOICE', 'TEXT']),
  unit: z.string().trim().max(30).default(''),
  refLow: nullableNum,
  refHigh: nullableNum,
  decimals: int(0, 4),
  options: lines(10),
  refText: nullableText(60),
});

export const rangeSchema = z.object({
  sex: z.preprocess((v) => (v === '' ? null : v), z.enum(['MALE', 'FEMALE', 'OTHER']).nullable()),
  ageMin: nullableInt(0, 120),
  ageMax: nullableInt(0, 120),
  low: money,
  high: money,
});

// Dates are entered as a day in India: a coupon starts at the start of that day and ends at its end.
const istDay = (edge: 'start' | 'end') =>
  z.preprocess((v) => {
    if (v === '' || v === null || v === undefined) return null;
    return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T${edge === 'start' ? '00:00:00' : '23:59:59'}+05:30`) : v;
  }, z.coerce.date().nullable());
export const couponBase = z.object({
  description: text(3, 120),
  type: z.enum(['PERCENT', 'FLAT']),
  value: int(1, 100_000),
  cap: nullableInt(1, 100_000),
  minOrder: int(0, 1_000_000),
  active: z.boolean(),
  maxUses: nullableInt(1, 1_000_000),
  startsAt: istDay('start'),
  endsAt: istDay('end'),
});
export const couponCreateSchema = couponBase.extend({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,20}$/, 'Use 3–20 letters or numbers.') });

export const slotSchema = z.object({ label: text(2, 30), capacity: int(0, 500), active: z.boolean(), morning: z.boolean() });

export const staffSchema = z.object({ phone: phoneSchema, name: personName, role: z.enum(['PHLEBOTOMIST', 'TECHNICIAN', 'PATHOLOGIST', 'ADMIN']) });
export const activeSchema = z.object({ active: z.boolean() });

export const callbackSchema = z.object({ status: z.enum(['NEW', 'CONTACTED', 'CLOSED']), note: nullableText(300) });
export const prescriptionSchema = z.object({ status: z.enum(['NEW', 'REVIEWED', 'CONVERTED', 'REJECTED']), note: nullableText(300) });

export const settingsSchema = z.object({
  phone: text(8, 20),
  whatsapp: z.string().trim().regex(/^\d{10,15}$/, 'Digits only, with country code, e.g. 919876543210.'),
  hours: text(3, 60),
  freeCollectionAbove: int(0, 100_000),
  collectionFee: int(0, 10_000),
  hardCopyFee: int(0, 10_000),
  pathologistTitle: text(2, 80),
});

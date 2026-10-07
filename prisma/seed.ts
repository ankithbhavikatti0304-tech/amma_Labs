/**
 * Seeds the catalogue from prisma/data/catalogue.json (extracted from the prototype).
 *
 * Safe to re-run: existing rows are left alone, so edits made in the admin panel (real
 * prices, ranges) are never overwritten. Set SEED_FORCE=1 to overwrite from the JSON.
 *
 * ALL PRICES AND REFERENCE RANGES HERE ARE PLACEHOLDERS from the prototype. The lab must
 * replace them (Admin → Tests) before launch.
 */
import { readFileSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { slugify } from '../src/lib/slug';

type Data = {
  categories: { id: string; name: string; icon: string; tint: string; mascot: string; mascotArg: string | null; sort: number }[];
  groups: Record<string, { name: string; parameters: string[] }>;
  reference: Record<string, { low: number; high: number; unit: string; decimals: number }>;
  tests: {
    id: string; name: string; categories: string[]; isPackage: boolean; parameterCount: number | null;
    tatMinHours: number; tatMaxHours: number; price: number; mrp: number; fasting: boolean; morningSample: boolean;
    centreVisit: boolean; qualitative: boolean; popular: boolean; includes: string[]; parameters: string[];
    tint: string; mascot: string; mascotArg: string | null;
  }[];
};

const data: Data = JSON.parse(readFileSync(new URL('./data/catalogue.json', import.meta.url), 'utf8'));
const force = process.env.SEED_FORCE === '1';
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 2 }) });

// "Create if missing" unless forced.
const upd = <T>(row: T): T | Record<string, never> => (force ? row : {});

// Collection windows. Capacity is a placeholder: the lab sets real numbers in Admin → Slots.
const SLOTS = [
  { id: 's0600', label: '6–8 am', start: 360, end: 480, morning: true },
  { id: 's0800', label: '8–10 am', start: 480, end: 600, morning: true },
  { id: 's1000', label: '10 am–12 pm', start: 600, end: 720, morning: false },
  { id: 's1600', label: '4–6 pm', start: 960, end: 1080, morning: false },
  { id: 's1800', label: '6–8 pm', start: 1080, end: 1200, morning: false },
];

const COUPONS = [
  { code: 'AMMA10', description: '10% off, up to ₹300', type: 'PERCENT' as const, value: 10, cap: 300, minOrder: 0 },
  { code: 'FIRST100', description: '₹100 off on orders of ₹999 and above', type: 'FLAT' as const, value: 100, cap: null, minOrder: 999 },
];

async function main() {
  // categories
  for (const c of data.categories) {
    const row = { name: c.name, icon: c.icon, tint: c.tint, mascot: c.mascot, mascotArg: c.mascotArg, sort: c.sort };
    await db.category.upsert({ where: { id: c.id }, create: { id: c.id, ...row }, update: upd(row) });
  }

  // numeric parameters from the prototype's reference table
  for (const [name, r] of Object.entries(data.reference)) {
    const row = { kind: 'NUMERIC' as const, unit: r.unit, refLow: r.low, refHigh: r.high, decimals: r.decimals };
    await db.parameter.upsert({ where: { name }, create: { name, ...row }, update: upd(row) });
  }

  // tests
  const usedSlugs = new Set<string>();
  let order = 0;
  for (const t of data.tests) {
    let slug = slugify(t.name);
    if (usedSlugs.has(slug)) slug = `${slug}-${t.id}`;
    usedSlugs.add(slug);

    const row = {
      name: t.name, isPackage: t.isPackage, parameterCount: t.parameterCount, tatMinHours: t.tatMinHours, tatMaxHours: t.tatMaxHours,
      price: t.price, mrp: t.mrp, fasting: t.fasting, morningSample: t.morningSample, centreVisit: t.centreVisit,
      popular: t.popular, includes: t.includes, mascot: t.mascot, mascotArg: t.mascotArg, tint: t.tint, sort: order++,
    };
    const existing = await db.test.findUnique({ where: { id: t.id }, select: { id: true } });
    if (existing && !force) continue;

    await db.test.upsert({ where: { id: t.id }, create: { id: t.id, slug, ...row }, update: { slug, ...row } });

    await db.testCategory.deleteMany({ where: { testId: t.id } });
    await db.testCategory.createMany({ data: t.categories.map((categoryId, position) => ({ testId: t.id, categoryId, position })) });

    // Which parameters does this test report? Entries are group keys or single parameter names.
    const wanted: { name: string; group: string | null }[] = [];
    for (const entry of t.parameters) {
      const g = data.groups[entry];
      if (g) g.parameters.forEach((name) => wanted.push({ name, group: g.name }));
      else wanted.push({ name: entry, group: null });
    }
    // Tests the prototype shows as a single line: a scan note, or a Negative/Positive result.
    if (t.centreVisit) {
      await db.parameter.upsert({ where: { name: t.name }, create: { name: t.name, kind: 'TEXT' }, update: {} });
      wanted.push({ name: t.name, group: null });
    } else if (t.qualitative) {
      await db.parameter.upsert({
        where: { name: t.name },
        create: { name: t.name, kind: 'CHOICE', options: ['Negative', 'Positive'], refText: 'Negative' },
        update: {},
      });
      wanted.push({ name: t.name, group: null });
    }

    const seen = new Set<string>();
    const links: { testId: string; parameterId: string; groupName: string | null; position: number }[] = [];
    for (const w of wanted) {
      if (seen.has(w.name)) continue;
      seen.add(w.name);
      const p = await db.parameter.findUnique({ where: { name: w.name }, select: { id: true } });
      if (!p) { console.warn(`  ! ${t.id}: no reference range for "${w.name}", skipped`); continue; }
      links.push({ testId: t.id, parameterId: p.id, groupName: w.group, position: links.length });
    }
    await db.testParameter.deleteMany({ where: { testId: t.id } });
    await db.testParameter.createMany({ data: links });
  }

  // slots
  for (const [i, s] of SLOTS.entries()) {
    const row = { label: s.label, startMinutes: s.start, endMinutes: s.end, morning: s.morning, sort: i };
    await db.slot.upsert({ where: { id: s.id }, create: { id: s.id, capacity: 20, ...row }, update: upd(row) });
  }

  // coupons
  for (const c of COUPONS) {
    const { code, ...row } = c;
    await db.coupon.upsert({ where: { code }, create: { code, ...row }, update: upd(row) });
  }

  // optional first admin: SEED_ADMIN_PHONE=98xxxxxxxx SEED_ADMIN_NAME="..."
  const adminPhone = process.env.SEED_ADMIN_PHONE;
  if (adminPhone) {
    if (!/^[6-9]\d{9}$/.test(adminPhone)) throw new Error('SEED_ADMIN_PHONE must be a 10-digit Indian mobile number');
    await db.user.upsert({
      where: { phone: adminPhone },
      create: { phone: adminPhone, name: process.env.SEED_ADMIN_NAME ?? 'Admin', role: 'ADMIN' },
      update: { role: 'ADMIN', active: true },
    });
    console.log(`Admin ready for ${adminPhone.slice(0, 2)}••••${adminPhone.slice(-4)}`);
  }

  const [tests, cats, params, slots, coupons] = await Promise.all([
    db.test.count(), db.category.count(), db.parameter.count(), db.slot.count(), db.coupon.count(),
  ]);
  console.log(`Seeded: ${tests} tests, ${cats} categories, ${params} parameters, ${slots} slots, ${coupons} coupons`);
}

main().finally(() => db.$disconnect());

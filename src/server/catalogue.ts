import 'server-only';
import { unstable_cache, revalidateTag } from 'next/cache';
import { db } from './db';
import { getSettings, toPublic } from './settings';
import type { CatalogueData, CategoryDTO, CouponDTO, TestDTO } from '@/lib/catalogue';
import type { Prisma } from '@/generated/prisma/client';

type TestRow = Prisma.TestGetPayload<{ include: { categories: { select: { categoryId: true } } } }>;

export const toTestDTO = (t: TestRow): TestDTO => ({
  id: t.id,
  slug: t.slug,
  name: t.name,
  isPackage: t.isPackage,
  parameterCount: t.parameterCount,
  tatMin: t.tatMinHours,
  tatMax: t.tatMaxHours,
  price: t.price,
  mrp: t.mrp,
  fasting: t.fasting,
  morningSample: t.morningSample,
  centreVisit: t.centreVisit,
  popular: t.popular,
  includes: t.includes,
  categories: t.categories.map((c) => c.categoryId),
  mascot: t.mascot,
  mascotArg: t.mascotArg,
  tint: t.tint,
});

async function load(): Promise<CatalogueData> {
  const now = new Date();
  const [categories, tests, coupons, settings] = await Promise.all([
    db.category.findMany({ orderBy: { sort: 'asc' } }),
    db.test.findMany({ where: { active: true }, orderBy: { sort: 'asc' }, include: { categories: { select: { categoryId: true }, orderBy: { position: 'asc' } } } }),
    db.coupon.findMany({
      where: { active: true, AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] },
      orderBy: { createdAt: 'asc' },
    }),
    getSettings(),
  ]);
  return {
    categories: categories.map((c): CategoryDTO => ({ id: c.id, name: c.name, icon: c.icon, tint: c.tint, mascot: c.mascot, mascotArg: c.mascotArg })),
    tests: tests.map(toTestDTO),
    coupons: coupons
      .filter((c) => c.maxUses === null || c.usedCount < c.maxUses)
      .map((c): CouponDTO => ({ code: c.code, description: c.description, type: c.type, value: c.value, cap: c.cap, minOrder: c.minOrder })),
    settings: toPublic(settings),
  };
}

/** The whole public catalogue, cached for 5 minutes and refreshed on admin edits. */
export const getCatalogue = unstable_cache(load, ['catalogue-v1'], { tags: ['catalogue', 'settings'], revalidate: 300 });

/** Call after any admin change to tests, categories, coupons or settings. Next request sees fresh data. */
export function invalidateCatalogue() {
  revalidateTag('catalogue', { expire: 0 });
  revalidateTag('settings', { expire: 0 });
}

import { readFileSync } from 'node:fs';
import { db } from '@/server/db';

type SeedTest = { id: string; price: number; mrp: number };
const seeded: SeedTest[] = JSON.parse(readFileSync(new URL('../prisma/data/catalogue.json', import.meta.url), 'utf8')).tests;

/**
 * Wipe everything people create, and put the seeded catalogue, slots and coupons back as the
 * seed made them. Tests that tweak a price or a slot's capacity can't leak into the next test,
 * even if they fail half way.
 */
export async function resetDb() {
  await db.$executeRawUnsafe(
    `TRUNCATE "Notification","AuditLog","WebhookEvent","Payment","Report","Result","Sample","OrderItem","Order","Prescription","CallbackRequest","Patient","Address","Session","OtpRequest","RateLimit","User" RESTART IDENTITY CASCADE`,
  );
  const current = await db.test.findMany({ select: { id: true, price: true, mrp: true, active: true } });
  const want = new Map(seeded.map((t) => [t.id, t]));
  for (const t of current) {
    const w = want.get(t.id);
    if (w && (t.price !== w.price || t.mrp !== w.mrp || !t.active)) await db.test.update({ where: { id: t.id }, data: { price: w.price, mrp: w.mrp, active: true } });
  }
  await db.slot.updateMany({ data: { capacity: 20, active: true } });
  await db.coupon.updateMany({ data: { usedCount: 0, maxUses: null, startsAt: null, endsAt: null, active: true } });
  await db.setting.deleteMany();
}

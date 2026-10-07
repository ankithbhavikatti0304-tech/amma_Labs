import 'server-only';
import { db } from './db';
import { BOOKING_DAYS, PENDING_PAYMENT_MINUTES } from '@/config/lab';
import { bookableDates, toDbDate } from '@/lib/ist';
import type { Prisma } from '@/generated/prisma/client';

export interface SlotDay {
  date: string;
  slots: { id: string; label: string; morning: boolean; available: boolean; remaining: number }[];
}

/** Orders that hold a place in a slot: live orders, plus unpaid online ones for a short while. */
export const holdsSlot = (): Prisma.OrderWhereInput => ({
  OR: [
    { status: { in: ['BOOKED', 'SAMPLE_COLLECTED', 'PROCESSING', 'REPORT_READY'] } },
    { status: 'PENDING_PAYMENT', createdAt: { gt: new Date(Date.now() - PENDING_PAYMENT_MINUTES * 60_000) } },
  ],
});

/** Availability for every bookable day, in one query. The browser applies the fasting rule (morning slots only). */
export async function listSlotDays(now: Date = new Date()): Promise<SlotDay[]> {
  const dates = bookableDates(BOOKING_DAYS, now);
  const [slots, counts] = await Promise.all([
    db.slot.findMany({ where: { active: true }, orderBy: { sort: 'asc' } }),
    db.order.groupBy({ by: ['slotDate', 'slotId'], where: { slotDate: { in: dates.map(toDbDate) }, AND: [holdsSlot()] }, _count: { _all: true } }),
  ]);
  const used = new Map(counts.map((c) => [`${c.slotDate.toISOString().slice(0, 10)}|${c.slotId}`, c._count._all]));
  return dates.map((date) => ({
    date,
    slots: slots.map((s) => {
      const remaining = Math.max(0, s.capacity - (used.get(`${date}|${s.id}`) ?? 0));
      return { id: s.id, label: s.label, morning: s.morning, remaining, available: remaining > 0 };
    }),
  }));
}

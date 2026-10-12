/**
 * Bookings are calendar days in India. Servers run in UTC, so never use the server's local
 * date for "today" or "tomorrow". India has no daylight saving, so a fixed +05:30 offset is exact.
 */
const IST_MS = 330 * 60_000;

/** YYYY-MM-DD for the given instant, as seen in India. */
export const istDate = (d: Date = new Date()): string => new Date(d.getTime() + IST_MS).toISOString().slice(0, 10);

/** Minutes since midnight in India. */
export const istMinutes = (d: Date = new Date()): number => {
  const t = new Date(d.getTime() + IST_MS);
  return t.getUTCHours() * 60 + t.getUTCMinutes();
};

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** The days a patient can book: tomorrow onwards. */
export const bookableDates = (count: number, now: Date = new Date()): string[] =>
  Array.from({ length: count }, (_, i) => addDays(istDate(now), i + 1));

/** A value for a Postgres DATE column. */
export const toDbDate = (date: string): Date => new Date(`${date}T00:00:00.000Z`);
export const fromDbDate = (d: Date): string => d.toISOString().slice(0, 10);

const noon = (date: string) => new Date(`${date}T12:00:00.000Z`);
const fmt = (date: string, o: Intl.DateTimeFormatOptions) => noon(date).toLocaleDateString('en-IN', { ...o, timeZone: 'UTC' });

export const weekdayShort = (date: string) => fmt(date, { weekday: 'short' });
export const dayMonth = (date: string) => fmt(date, { day: 'numeric', month: 'short' });
/** Thu, 8 Oct */
export const longDate = (date: string) => fmt(date, { weekday: 'short', day: 'numeric', month: 'short' });
export const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

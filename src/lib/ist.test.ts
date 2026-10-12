import { describe, expect, it } from 'vitest';
import { addDays, bookableDates, istDate, istMinutes, longDate } from './ist';

describe('IST dates', () => {
  it('uses the Indian calendar day, not UTC', () => {
    // 20:00 UTC on 7 Oct is 01:30 IST on 8 Oct
    expect(istDate(new Date('2026-10-07T20:00:00Z'))).toBe('2026-10-08');
    expect(istDate(new Date('2026-10-07T18:29:00Z'))).toBe('2026-10-07');
    expect(istDate(new Date('2026-10-07T18:30:00Z'))).toBe('2026-10-08');
  });
  it('reads minutes since midnight in IST', () => {
    expect(istMinutes(new Date('2026-10-07T00:30:00Z'))).toBe(6 * 60);
  });
  it('adds days across month and year ends', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });
  it('offers the next five days starting tomorrow', () => {
    expect(bookableDates(5, new Date('2026-10-07T05:00:00Z'))).toEqual(['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12']);
  });
  it('formats a date in en-IN', () => {
    expect(longDate('2026-10-08')).toMatch(/Thu.*8.*Oct/);
  });
});

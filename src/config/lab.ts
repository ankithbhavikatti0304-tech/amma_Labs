/**
 * Lab details and business rules.
 *
 * PLACEHOLDERS: the phone/WhatsApp numbers, hours and fees below are the prototype's sample
 * values. The lab changes them in Admin → Settings (stored in the Setting table, which
 * overrides these defaults), so no redeploy is needed.
 */
export const LAB_DEFAULTS = {
  phone: '+91 98765 43210',
  /** Digits only, with country code, for wa.me links. */
  whatsapp: '919876543210',
  hours: '6 am – 9 pm, all days',
  /** Home collection is free at or above this basket value (after coupon). */
  freeCollectionAbove: 499,
  collectionFee: 99,
  hardCopyFee: 150,
  /** Name printed under "Verified by" until a pathologist's own name is on their account. */
  pathologistTitle: 'Consultant pathologist',
} as const;

export interface LabSettings {
  phone: string;
  whatsapp: string;
  hours: string;
  freeCollectionAbove: number;
  collectionFee: number;
  hardCopyFee: number;
  pathologistTitle: string;
}

export const CITIES = ['Bengaluru', 'Mysuru', 'Hubballi', 'Mangaluru'] as const;
export type City = (typeof CITIES)[number];
export const DEFAULT_CITY: City = 'Bengaluru';
export const CITY_COOKIE = 'al_city';

/** Pincode prefixes we collect from. The prototype accepts anything starting with 5 (Karnataka). */
export const SERVICEABLE_PINCODE_PREFIXES = ['5'] as const;

/** How many days ahead can be booked, starting tomorrow. */
export const BOOKING_DAYS = 5;

/** An unpaid online order keeps its slot this long before it is released. */
export const PENDING_PAYMENT_MINUTES = 15;

/** Bump when the privacy notice changes, so consent can be re-collected. */
export const CONSENT_VERSION = '2026-10';

export const SESSION = {
  cookie: 'al_session',
  /** Patients stay logged in on their own phone, sliding. */
  patientIdleDays: 14,
  patientMaxDays: 60,
  /** Staff handle other people's health data: shorter sessions. */
  staffIdleHours: 4,
  staffMaxHours: 12,
} as const;

export const OTP = {
  length: 6,
  ttlSeconds: 5 * 60,
  resendSeconds: 30,
  maxAttempts: 5,
  /** Whole-site ceiling per hour, so a flood of fake numbers cannot run up the SMS bill. */
  globalPerHour: 1500,
} as const;

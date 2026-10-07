import 'server-only';
import { z } from 'zod';
import { isValidPhone, normalizePhone } from '@/lib/phone';

/** A 10-digit Indian mobile. Accepts pasted "+91 98765 43210" and normalises it. */
export const phoneSchema = z
  .string()
  .max(20)
  .transform(normalizePhone)
  .refine(isValidPhone, 'Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9.');

/** Human names: letters (any script), spaces and . ' - only. */
export const personName = z
  .string()
  .trim()
  .min(2, 'Enter the name as it should appear on the report.')
  .max(80)
  .regex(/^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u, 'Use letters only.');

export const sendOtpSchema = z.object({ phone: phoneSchema, name: personName, consent: z.boolean() });
export const verifyOtpSchema = z.object({ phone: phoneSchema, code: z.string().regex(/^\d{6}$/, 'Enter all 6 digits.') });

import { CITIES } from '@/config/lab';
import { isIsoDate } from '@/lib/ist';

export const createOrderSchema = z.object({
  items: z.array(z.string().min(1).max(40)).min(1, 'Your cart is empty.').max(30),
  coupon: z.string().max(24).regex(/^[A-Za-z0-9]+$/).nullish(),
  hardCopy: z.boolean(),
  patient: z.object({
    name: personName,
    age: z.number().int().min(0, 'Enter age in years.').max(120, 'Enter age in years.'),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  }),
  address: z.object({ line: z.string().trim().min(8, 'Enter the full address for sample pickup.').max(200), pincode: z.string().regex(/^\d{6}$/, 'Enter a 6-digit pincode.') }).nullish(),
  city: z.enum(CITIES),
  slot: z.object({ date: z.string().refine(isIsoDate, 'Pick a date.'), slotId: z.string().min(1).max(30) }),
  payMode: z.enum(['COD', 'ONLINE']),
  expectedTotal: z.number().int().min(0).max(10_000_000),
});

export const orderCode = z.string().regex(/^AL-[A-Z0-9]{6}$/);

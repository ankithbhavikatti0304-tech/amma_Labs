import 'server-only';
import { db } from '../db';
import { hashOtp, safeEqual } from '../crypto';
import { sms } from '../sms';
import { hit } from '../rate-limit';
import { ApiError } from '../http-errors';
import { OTP, CONSENT_VERSION } from '@/config/lab';
import { randomInt } from 'node:crypto';
import { createSession } from './session';
import { log } from '../log';
import type { Role } from '@/generated/prisma/enums';

export interface SendOtpInput {
  phone: string;
  name: string;
  consent: boolean;
  ipKey: string;
}

/**
 * Issue an OTP. Always behaves the same whether or not the number already has an account
 * (no account enumeration). Name is stored with the request and only used if the account
 * is created at verify time.
 */
export async function sendOtp({ phone, name, consent, ipKey }: SendOtpInput): Promise<{ resendAfter: number; expiresIn: number; devCode?: string }> {
  if (!consent) throw new ApiError(400, 'consent_required', 'Please agree to the privacy notice to continue.');

  // Limits: one code per 30 s per number, 5 an hour per number, 20 an hour per network address.
  const gap = await hit('otp-gap', phone, 1, OTP.resendSeconds);
  if (!gap.ok) throw new ApiError(429, 'rate_limited', `Please wait ${gap.retryAfter} seconds before asking for another code.`, { retryAfter: gap.retryAfter });
  const perPhone = await hit('otp-phone', phone, 5, 3600);
  if (!perPhone.ok) throw new ApiError(429, 'rate_limited', 'Too many codes requested for this number. Try again in an hour.', { retryAfter: perPhone.retryAfter });
  const perIp = await hit('otp-ip', ipKey, 20, 3600);
  if (!perIp.ok) throw new ApiError(429, 'rate_limited', 'Too many requests from this network. Try again later.', { retryAfter: perIp.retryAfter });

  const code = String(randomInt(10 ** (OTP.length - 1), 10 ** OTP.length));
  const expiresAt = new Date(Date.now() + OTP.ttlSeconds * 1000);

  // One live code per number: asking again retires the previous one.
  const [, row] = await db.$transaction([
    db.otpRequest.updateMany({ where: { phone, consumedAt: null }, data: { consumedAt: new Date() } }),
    db.otpRequest.create({ data: { phone, codeHash: hashOtp(phone, code), name, expiresAt }, select: { id: true } }),
  ]);

  try {
    const { devCode } = await sms().sendOtp(phone, code);
    return { resendAfter: OTP.resendSeconds, expiresIn: OTP.ttlSeconds, ...(devCode ? { devCode } : {}) };
  } catch (err) {
    // Don't leave a code the person never received.
    await db.otpRequest.delete({ where: { id: row.id } }).catch(() => undefined);
    log.error('otp delivery failed', { err });
    throw new ApiError(502, 'sms_failed', "We couldn't send the code. Please try again in a moment.");
  }
}

export interface VerifyOtpInput {
  phone: string;
  code: string;
  ipKey: string;
  userAgent?: string | null;
}

export interface VerifiedLogin {
  user: { id: string; name: string; phone: string; role: Role };
  token: string;
  expiresAt: Date;
  created: boolean;
}

const BAD_CODE = new ApiError(400, 'invalid_code', "That code doesn't match. Check the message and try again.");
const NO_CODE = new ApiError(400, 'code_expired', 'That code has expired. Ask for a new one.');

export async function verifyOtp({ phone, code, ipKey, userAgent }: VerifyOtpInput): Promise<VerifiedLogin> {
  const perPhone = await hit('otp-verify-phone', phone, 10, 3600);
  const perIp = await hit('otp-verify-ip', ipKey, 40, 3600);
  if (!perPhone.ok || !perIp.ok) throw new ApiError(429, 'rate_limited', 'Too many attempts. Try again later.', { retryAfter: Math.max(perPhone.retryAfter, perIp.retryAfter) });

  const now = new Date();
  const req = await db.otpRequest.findFirst({ where: { phone, consumedAt: null, expiresAt: { gt: now } }, orderBy: { createdAt: 'desc' } });
  if (!req) throw NO_CODE;

  // Count the attempt first, atomically, and only while attempts remain. Two parallel guesses
  // can't both slip under the cap.
  const bumped = await db.otpRequest.updateMany({ where: { id: req.id, consumedAt: null, attempts: { lt: OTP.maxAttempts } }, data: { attempts: { increment: 1 } } });
  if (bumped.count === 0) throw new ApiError(400, 'too_many_attempts', 'Too many wrong codes. Ask for a new one.');

  if (!safeEqual(req.codeHash, hashOtp(phone, code))) throw BAD_CODE;

  // Burn the code. Only one request wins, even if two correct submissions race.
  const burned = await db.otpRequest.updateMany({ where: { id: req.id, consumedAt: null }, data: { consumedAt: now } });
  if (burned.count === 0) throw NO_CODE;

  const existing = await db.user.findUnique({ where: { phone } });
  if (existing && !existing.active) throw new ApiError(403, 'account_disabled', 'This account is disabled. Please call us.');

  const user = existing
    ? await db.user.update({ where: { id: existing.id }, data: { lastLoginAt: now, ...(existing.consentAt ? {} : { consentAt: now, consentVersion: CONSENT_VERSION }) } })
    : await db.user.create({ data: { phone, name: (req.name ?? 'Patient').trim() || 'Patient', consentAt: now, consentVersion: CONSENT_VERSION, lastLoginAt: now } });

  const { token, expiresAt } = await createSession(user.id, user.role, userAgent);
  return { user: { id: user.id, name: user.name, phone: user.phone, role: user.role }, token, expiresAt, created: !existing };
}

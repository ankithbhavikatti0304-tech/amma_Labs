import 'server-only';
import { randomInt } from 'node:crypto';
import { db } from '../db';
import { hashEmailOtp, safeEqual } from '../crypto';
import { email as emailProvider } from '../email';
import { hit } from '../rate-limit';
import { ApiError } from '../http-errors';
import { log } from '../log';
import { OTP, CONSENT_VERSION } from '@/config/lab';
import { createSession } from './session';
import type { Role } from '@/generated/prisma/enums';

/**
 * Login by email (LOGIN_METHOD=email). Same rules as the SMS flow in otp.ts: a code that lives 5 minutes,
 * is stored only as a keyed hash, allows 5 attempts, and is retired when a new one is asked for.
 * The mobile number typed on the form is only a contact number for the pickup call. It proves nothing
 * and is never used to find an account.
 */
export interface SendEmailOtpInput {
  email: string;
  phone: string;
  name: string;
  consent: boolean;
  ipKey: string;
}

export async function sendEmailOtp({ email, phone, name, consent, ipKey }: SendEmailOtpInput): Promise<{ resendAfter: number; expiresIn: number; devCode?: string }> {
  if (!consent) throw new ApiError(400, 'consent_required', 'Please agree to the privacy notice to continue.');

  // Limits: one code per 30 s per address, 5 an hour per address, 20 an hour per network address, and a site-wide ceiling.
  const gap = await hit('otp-gap', email, 1, OTP.resendSeconds);
  if (!gap.ok) throw new ApiError(429, 'rate_limited', `Please wait ${gap.retryAfter} seconds before asking for another code.`, { retryAfter: gap.retryAfter });
  const perEmail = await hit('otp-email', email, 5, 3600);
  if (!perEmail.ok) throw new ApiError(429, 'rate_limited', 'Too many codes requested for this email. Try again in an hour.', { retryAfter: perEmail.retryAfter });
  const global = await hit('otp-global', 'all', OTP.globalPerHour, 3600);
  if (!global.ok) throw new ApiError(503, 'busy', 'We are getting a lot of requests right now. Please try again in a few minutes, or call us to book.', { retryAfter: global.retryAfter });
  const perIp = await hit('otp-ip', ipKey, 20, 3600);
  if (!perIp.ok) throw new ApiError(429, 'rate_limited', 'Too many requests from this network. Try again later.', { retryAfter: perIp.retryAfter });

  const code = String(randomInt(10 ** (OTP.length - 1), 10 ** OTP.length));
  const expiresAt = new Date(Date.now() + OTP.ttlSeconds * 1000);

  const [, row] = await db.$transaction([
    db.otpRequest.updateMany({ where: { email, consumedAt: null }, data: { consumedAt: new Date() } }),
    db.otpRequest.create({ data: { email, phone, codeHash: hashEmailOtp(email, code), name, expiresAt }, select: { id: true } }),
  ]);

  try {
    const { devCode } = await emailProvider().sendLoginCode(email, code);
    return { resendAfter: OTP.resendSeconds, expiresIn: OTP.ttlSeconds, ...(devCode ? { devCode } : {}) };
  } catch (err) {
    await db.otpRequest.delete({ where: { id: row.id } }).catch(() => undefined);
    log.error('login email delivery failed', { err });
    throw new ApiError(502, 'email_failed', "We couldn't send the code. Please check the address and try again in a moment.");
  }
}

export interface VerifyEmailOtpInput {
  email: string;
  code: string;
  ipKey: string;
  userAgent?: string | null;
}

export interface VerifiedEmailLogin {
  user: { id: string; name: string; phone: string; email: string | null; role: Role };
  token: string;
  expiresAt: Date;
  created: boolean;
}

const BAD_CODE = new ApiError(400, 'invalid_code', "That code doesn't match. Check your email and try again.");
const NO_CODE = new ApiError(400, 'code_expired', 'That code has expired. Ask for a new one.');

export async function verifyEmailOtp({ email, code, ipKey, userAgent }: VerifyEmailOtpInput): Promise<VerifiedEmailLogin> {
  const perEmail = await hit('otp-verify-email', email, 10, 3600);
  const perIp = await hit('otp-verify-ip', ipKey, 40, 3600);
  if (!perEmail.ok || !perIp.ok) throw new ApiError(429, 'rate_limited', 'Too many attempts. Try again later.', { retryAfter: Math.max(perEmail.retryAfter, perIp.retryAfter) });

  const now = new Date();
  const req = await db.otpRequest.findFirst({ where: { email, consumedAt: null, expiresAt: { gt: now } }, orderBy: { createdAt: 'desc' } });
  if (!req) throw NO_CODE;

  // Count the attempt first, atomically, and only while attempts remain, so parallel guesses can't slip under the cap.
  const bumped = await db.otpRequest.updateMany({ where: { id: req.id, consumedAt: null, attempts: { lt: OTP.maxAttempts } }, data: { attempts: { increment: 1 } } });
  if (bumped.count === 0) throw new ApiError(400, 'too_many_attempts', 'Too many wrong codes. Ask for a new one.');

  if (!safeEqual(req.codeHash, hashEmailOtp(email, code))) throw BAD_CODE;

  const burned = await db.otpRequest.updateMany({ where: { id: req.id, consumedAt: null }, data: { consumedAt: now } });
  if (burned.count === 0) throw NO_CODE;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing && !existing.active) throw new ApiError(403, 'account_disabled', 'This account is disabled. Please call us.');

  let user;
  let created = false;
  if (existing) {
    user = await db.user.update({ where: { id: existing.id }, data: { lastLoginAt: now, ...(existing.consentAt ? {} : { consentAt: now, consentVersion: CONSENT_VERSION }) } });
  } else {
    try {
      user = await db.user.create({ data: { email, phone: req.phone, name: (req.name ?? 'Patient').trim() || 'Patient', consentAt: now, consentVersion: CONSENT_VERSION, lastLoginAt: now } });
      created = true;
    } catch (e) {
      // Two first-time verifications racing: the unique email makes one lose. It simply signs in to the winner's account.
      if (typeof e === 'object' && e && 'code' in e && e.code === 'P2002') {
        const winner = await db.user.findUnique({ where: { email } });
        if (!winner || !winner.active) throw new ApiError(403, 'account_disabled', 'This account is disabled. Please call us.');
        user = winner;
      } else throw e;
    }
  }

  const { token, expiresAt } = await createSession(user.id, user.role, userAgent);
  return { user: { id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role }, token, expiresAt, created };
}

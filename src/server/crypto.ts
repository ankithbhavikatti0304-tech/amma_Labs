import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from './env';

/** 32 random bytes, URL-safe. Used for session tokens. */
export const randomToken = (): string => randomBytes(32).toString('base64url');

export const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

/** Keyed hash with a purpose label, so a hash made for one use can't be replayed for another. */
export const hmac = (purpose: string, data: string): string =>
  createHmac('sha256', env().APP_SECRET).update(`${purpose}\0${data}`).digest('hex');

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** A 6-digit code is only ~20 bits, so the hash is keyed and the real defences are expiry and the attempt cap. */
export const hashOtp = (phone: string, code: string): string => hmac('otp', `${phone}:${code}`);

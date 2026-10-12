import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { jar, mockNextHeaders, req } from '../../../test/next-mocks';
import { resetDb } from '../../../test/db';
import { db } from '../db';
import { setEmailProvider } from '../email';
import { resetEnvCache } from '../env';
import { hashEmailOtp } from '../crypto';
import { findSession } from './session';
import { sendEmailOtp, verifyEmailOtp } from './email-otp';
import { sendOtp } from './otp';
import { NextRequest } from 'next/server';
import * as sendRoute from '../../app/api/auth/email/send/route';
import * as verifyRoute from '../../app/api/auth/email/verify/route';
import * as phoneSendRoute from '../../app/api/auth/otp/send/route';

mockNextHeaders();
vi.setConfig({ testTimeout: 20000 });

const EMAIL = 'lakshmi@example.com';
const PHONE = '9876543210';
const base = { email: EMAIL, phone: PHONE, name: 'Lakshmi Rao', consent: true, ipKey: 'ip1' };

function captureEmail() {
  const sent: { to: string; code: string }[] = [];
  setEmailProvider({ sendLoginCode: async (to, code) => (sent.push({ to, code }), {}) });
  return sent;
}
const nextCode = async (sent: { code: string }[]) => {
  await db.rateLimit.deleteMany({ where: { key: { startsWith: 'otp-gap:' } } });
  return sent.length;
};

beforeEach(async () => {
  await resetDb();
  jar.clear();
  setEmailProvider(undefined);
  process.env.LOGIN_METHOD = 'email';
  resetEnvCache();
});

afterAll(() => {
  delete process.env.LOGIN_METHOD;
  resetEnvCache();
  setEmailProvider(undefined);
});

describe('sendEmailOtp', () => {
  it('stores a keyed hash, never the code, and the dev provider returns it for the screen', async () => {
    const r = await sendEmailOtp(base);
    expect(r.devCode).toMatch(/^\d{6}$/);
    const row = await db.otpRequest.findFirstOrThrow();
    expect(row.email).toBe(EMAIL);
    expect(row.codeHash).toBe(hashEmailOtp(EMAIL, r.devCode!));
    expect(JSON.stringify(row)).not.toContain(r.devCode!);
  });

  it('a phone code can never be replayed as an email code', async () => {
    const r = await sendEmailOtp(base);
    const { hashOtp } = await import('../crypto');
    expect(hashOtp(EMAIL, r.devCode!)).not.toBe(hashEmailOtp(EMAIL, r.devCode!));
  });

  it('requires consent and enforces the 30-second gap and the hourly cap per address', async () => {
    await expect(sendEmailOtp({ ...base, consent: false })).rejects.toMatchObject({ code: 'consent_required' });
    await sendEmailOtp(base);
    await expect(sendEmailOtp(base)).rejects.toMatchObject({ status: 429 });
    for (let i = 0; i < 4; i++) {
      await db.rateLimit.deleteMany({ where: { key: { startsWith: 'otp-gap:' } } });
      await sendEmailOtp(base);
    }
    await db.rateLimit.deleteMany({ where: { key: { startsWith: 'otp-gap:' } } });
    await expect(sendEmailOtp(base)).rejects.toMatchObject({ status: 429 });
  });

  it('a new code retires the previous one', async () => {
    const sent = captureEmail();
    await sendEmailOtp(base);
    await nextCode(sent);
    await sendEmailOtp(base);
    await expect(verifyEmailOtp({ email: EMAIL, code: sent[0]!.code, ipKey: 'ip1' })).rejects.toMatchObject({ code: 'invalid_code' });
    await expect(verifyEmailOtp({ email: EMAIL, code: sent[1]!.code, ipKey: 'ip1' })).resolves.toBeTruthy();
  });

  it('when the email cannot be sent it says so and leaves no unusable code behind', async () => {
    setEmailProvider({ sendLoginCode: async () => { throw new Error('gateway down'); } });
    await expect(sendEmailOtp(base)).rejects.toMatchObject({ status: 502, code: 'email_failed' });
    expect(await db.otpRequest.count()).toBe(0);
  });
});

describe('verifyEmailOtp', () => {
  it('creates the account on first sign-in with the contact phone, then signs the same person in again', async () => {
    const sent = captureEmail();
    await sendEmailOtp(base);
    const first = await verifyEmailOtp({ email: EMAIL, code: sent[0]!.code, ipKey: 'ip1' });
    expect(first.created).toBe(true);
    expect(first.user).toMatchObject({ name: 'Lakshmi Rao', email: EMAIL, phone: PHONE, role: 'PATIENT' });
    const u = await db.user.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(u.consentAt).toBeTruthy();
    expect(await findSession(first.token)).toMatchObject({ user: { id: u.id, email: EMAIL } });

    await nextCode(sent);
    await sendEmailOtp({ ...base, name: 'Someone Else', phone: '9000000009' });
    const second = await verifyEmailOtp({ email: EMAIL, code: sent[1]!.code, ipKey: 'ip1' });
    expect(second.created).toBe(false);
    expect(second.user.id).toBe(first.user.id);
    expect(second.user).toMatchObject({ name: 'Lakshmi Rao', phone: PHONE });
    expect(await db.user.count()).toBe(1);
  });

  it('treats upper and lower case addresses as one person (the schema lower-cases them)', async () => {
    const { emailSchema } = await import('../schemas');
    expect(emailSchema.parse('  Lakshmi@Example.COM ')).toBe(EMAIL);
    expect(() => emailSchema.parse('not an email')).toThrow();
  });

  it('two people can share one mobile number, each with their own email and their own records', async () => {
    const sent = captureEmail();
    await sendEmailOtp(base);
    const a = await verifyEmailOtp({ email: EMAIL, code: sent[0]!.code, ipKey: 'ip1' });
    await sendEmailOtp({ ...base, email: 'son@example.com', name: 'Her Son' });
    const b = await verifyEmailOtp({ email: 'son@example.com', code: sent[1]!.code, ipKey: 'ip1' });
    expect(a.user.id).not.toBe(b.user.id);
    expect(await db.user.count({ where: { phone: PHONE } })).toBe(2);
  });

  it('five wrong guesses lock the code, even the right one afterwards', async () => {
    const sent = captureEmail();
    await sendEmailOtp(base);
    const wrong = sent[0]!.code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) await expect(verifyEmailOtp({ email: EMAIL, code: wrong, ipKey: 'ip1' })).rejects.toMatchObject({ code: 'invalid_code' });
    await expect(verifyEmailOtp({ email: EMAIL, code: sent[0]!.code, ipKey: 'ip1' })).rejects.toMatchObject({ code: 'too_many_attempts' });
  });

  it('rejects an expired code and a code that was already used', async () => {
    const sent = captureEmail();
    await sendEmailOtp(base);
    await db.otpRequest.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(verifyEmailOtp({ email: EMAIL, code: sent[0]!.code, ipKey: 'ip1' })).rejects.toMatchObject({ code: 'code_expired' });
    await nextCode(sent);
    await sendEmailOtp(base);
    await verifyEmailOtp({ email: EMAIL, code: sent[1]!.code, ipKey: 'ip1' });
    await expect(verifyEmailOtp({ email: EMAIL, code: sent[1]!.code, ipKey: 'ip1' })).rejects.toMatchObject({ code: 'code_expired' });
  });

  it('the same code only works for the address it was sent to', async () => {
    const sent = captureEmail();
    await sendEmailOtp(base);
    await expect(verifyEmailOtp({ email: 'other@example.com', code: sent[0]!.code, ipKey: 'ip1' })).rejects.toMatchObject({ code: 'code_expired' });
  });

  it('refuses a disabled account', async () => {
    const sent = captureEmail();
    await db.user.create({ data: { email: EMAIL, phone: PHONE, name: 'X', active: false } });
    await sendEmailOtp(base);
    await expect(verifyEmailOtp({ email: EMAIL, code: sent[0]!.code, ipKey: 'ip1' })).rejects.toMatchObject({ code: 'account_disabled' });
  });

  it('two first-time verifications at once end up in one account', async () => {
    const sent = captureEmail();
    await sendEmailOtp(base);
    const code = sent[0]!.code;
    const results = await Promise.allSettled([verifyEmailOtp({ email: EMAIL, code, ipKey: 'ip1' }), verifyEmailOtp({ email: EMAIL, code, ipKey: 'ip2' })]);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBe(1);
    expect(await db.user.count()).toBe(1);
  });
});

describe('email routes', () => {
  async function call(mod: typeof sendRoute | typeof verifyRoute | typeof phoneSendRoute, r: Request) {
    return mod.POST(new NextRequest(r));
  }

  it('signs in end to end and sets an httpOnly, SameSite=Lax cookie', async () => {
    const send = await call(sendRoute, req('/api/auth/email/send', { body: { email: ' Lakshmi@Example.com ', phone: '+91 98765 43210', name: 'Lakshmi Rao', consent: true } }));
    expect(send.status).toBe(200);
    const { devCode } = await send.json();
    const verify = await call(verifyRoute, req('/api/auth/email/verify', { body: { email: EMAIL, code: devCode } }));
    expect(verify.status).toBe(200);
    expect((await verify.json()).user).toMatchObject({ email: EMAIL, phone: PHONE });
    expect([...jar.values()][0]!.opts).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' });
  });

  it('gives field errors for a bad address or number', async () => {
    const r = await call(sendRoute, req('/api/auth/email/send', { body: { email: 'nope', phone: '123', name: 'L', consent: true } }));
    expect(r.status).toBe(400);
    const j = await r.json();
    expect(j.error.fields.email).toBeTruthy();
    expect(j.error.fields.phone).toBeTruthy();
  });

  it('blocks cross-origin POSTs', async () => {
    const r = await call(sendRoute, req('/api/auth/email/send', { body: { email: EMAIL, phone: PHONE, name: 'Lakshmi Rao', consent: true }, headers: { origin: 'https://evil.example' } }));
    expect(r.status).toBe(403);
  });

  it('the phone routes are closed on an email site, and the email routes on a phone site', async () => {
    const phone = await call(phoneSendRoute, req('/api/auth/otp/send', { body: { phone: PHONE, name: 'Lakshmi Rao', consent: true } }));
    expect(phone.status).toBe(404);
    process.env.LOGIN_METHOD = 'phone';
    resetEnvCache();
    const mail = await call(sendRoute, req('/api/auth/email/send', { body: { email: EMAIL, phone: PHONE, name: 'Lakshmi Rao', consent: true } }));
    expect(mail.status).toBe(404);
    expect(await db.otpRequest.count()).toBe(0);
    await expect(sendOtp({ phone: PHONE, name: 'Lakshmi Rao', consent: true, ipKey: 'ip1' })).resolves.toBeTruthy();
  });
});

describe('phone sign-in without a unique phone column', () => {
  it('two first-time verifications for one number at once end up in one account', async () => {
    process.env.LOGIN_METHOD = 'phone';
    resetEnvCache();
    const { setSmsProvider } = await import('../sms');
    const { verifyOtp } = await import('./otp');
    const sent: string[] = [];
    setSmsProvider({ sendOtp: async (_p, c) => (sent.push(c), {}) });
    await sendOtp({ phone: PHONE, name: 'Lakshmi Rao', consent: true, ipKey: 'ip1' });
    const results = await Promise.allSettled([verifyOtp({ phone: PHONE, code: sent[0]!, ipKey: 'ip1' }), verifyOtp({ phone: PHONE, code: sent[0]!, ipKey: 'ip2' })]);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBe(1);
    expect(await db.user.count({ where: { phone: PHONE } })).toBe(1);
    setSmsProvider(undefined);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jar, mockNextHeaders, req } from '../../../test/next-mocks';
import { resetDb } from '../../../test/db';
import { db } from '../db';
import { setSmsProvider } from '../sms';
import { hashOtp } from '../crypto';
import { findSession, revokeSession } from './session';
import { sendOtp, verifyOtp } from './otp';
import { NextRequest } from 'next/server';
import * as sendRoute from '../../app/api/auth/otp/send/route';
import * as verifyRoute from '../../app/api/auth/otp/verify/route';
import * as logoutRoute from '../../app/api/auth/logout/route';
import * as meRoute from '../../app/api/auth/me/route';

const routes = { 'otp/send': sendRoute, 'otp/verify': verifyRoute, logout: logoutRoute, me: meRoute } as const;

mockNextHeaders();

const PHONE = '9876543210';
const base = { phone: PHONE, name: 'Lakshmi Rao', consent: true, ipKey: 'ip1' };

/** Capture the code the "SMS" would have carried. */
function captureSms() {
  const sent: { phone: string; code: string }[] = [];
  setSmsProvider({ sendOtp: async (phone, code) => (sent.push({ phone, code }), {}) });
  return sent;
}

beforeEach(async () => {
  await resetDb();
  jar.clear();
  setSmsProvider(undefined);
});

describe('sendOtp', () => {
  it('stores a hash, never the code, and the dev provider returns it for the UI', async () => {
    const r = await sendOtp(base);
    expect(r.devCode).toMatch(/^\d{6}$/);
    expect(r.resendAfter).toBe(30);
    expect(r.expiresIn).toBe(300);
    const row = await db.otpRequest.findFirstOrThrow();
    expect(row.codeHash).toBe(hashOtp(PHONE, r.devCode!));
    expect(JSON.stringify(row)).not.toContain(r.devCode!);
  });

  it('requires consent (DPDP)', async () => {
    await expect(sendOtp({ ...base, consent: false })).rejects.toMatchObject({ code: 'consent_required' });
    expect(await db.otpRequest.count()).toBe(0);
  });

  it('enforces the 30-second resend gap', async () => {
    await sendOtp(base);
    await expect(sendOtp(base)).rejects.toMatchObject({ status: 429, code: 'rate_limited' });
  });

  it('caps codes per number per hour', async () => {
    for (let i = 0; i < 5; i++) {
      await db.rateLimit.deleteMany({ where: { key: { startsWith: 'otp-gap:' } } }); // skip the 30 s gap, test the hourly cap
      await sendOtp(base);
    }
    await db.rateLimit.deleteMany({ where: { key: { startsWith: 'otp-gap:' } } });
    await expect(sendOtp(base)).rejects.toMatchObject({ status: 429 });
  });

  it('a new code retires the previous one', async () => {
    const sent = captureSms();
    await sendOtp(base);
    await db.rateLimit.deleteMany({ where: { key: { startsWith: 'otp-gap:' } } });
    await sendOtp(base);
    await expect(verifyOtp({ phone: PHONE, code: sent[0]!.code, ipKey: 'ip1' })).rejects.toMatchObject({ code: 'invalid_code' });
    await expect(verifyOtp({ phone: PHONE, code: sent[1]!.code, ipKey: 'ip1' })).resolves.toBeTruthy();
  });

  it('removes the code and reports a clean error when the SMS gateway fails', async () => {
    setSmsProvider({ sendOtp: async () => { throw new Error('gateway down: secret-detail'); } });
    await expect(sendOtp(base)).rejects.toMatchObject({ status: 502, code: 'sms_failed' });
    expect(await db.otpRequest.count()).toBe(0);
  });
});

describe('verifyOtp', () => {
  it('creates the account on first login with consent recorded, then reuses it', async () => {
    const sent = captureSms();
    await sendOtp(base);
    const first = await verifyOtp({ phone: PHONE, code: sent[0]!.code, ipKey: 'ip1' });
    expect(first.created).toBe(true);
    expect(first.user).toMatchObject({ name: 'Lakshmi Rao', phone: PHONE, role: 'PATIENT' });
    const u = await db.user.findUniqueOrThrow({ where: { phone: PHONE } });
    expect(u.consentAt).toBeTruthy();
    expect(u.consentVersion).toBeTruthy();

    await db.rateLimit.deleteMany({});
    await sendOtp({ ...base, name: 'Someone Else' });
    const second = await verifyOtp({ phone: PHONE, code: sent[1]!.code, ipKey: 'ip1' });
    expect(second.created).toBe(false);
    expect(second.user.name).toBe('Lakshmi Rao'); // a typed name never renames an existing account
    expect(await db.user.count()).toBe(1);
  });

  it('rejects a wrong code and locks the code after 5 wrong tries, even if the 6th is right', async () => {
    const sent = captureSms();
    await sendOtp(base);
    const wrong = sent[0]!.code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) await expect(verifyOtp({ phone: PHONE, code: wrong, ipKey: 'ip1' })).rejects.toMatchObject({ code: 'invalid_code' });
    await expect(verifyOtp({ phone: PHONE, code: sent[0]!.code, ipKey: 'ip1' })).rejects.toMatchObject({ code: 'too_many_attempts' });
    expect(await db.user.count()).toBe(0);
  });

  it('expires after 5 minutes', async () => {
    const sent = captureSms();
    await sendOtp(base);
    await db.otpRequest.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(verifyOtp({ phone: PHONE, code: sent[0]!.code, ipKey: 'ip1' })).rejects.toMatchObject({ code: 'code_expired' });
  });

  it('a code works once only', async () => {
    const sent = captureSms();
    await sendOtp(base);
    await verifyOtp({ phone: PHONE, code: sent[0]!.code, ipKey: 'ip1' });
    await expect(verifyOtp({ phone: PHONE, code: sent[0]!.code, ipKey: 'ip1' })).rejects.toMatchObject({ code: 'code_expired' });
  });

  it('two simultaneous correct submissions create one session', async () => {
    const sent = captureSms();
    await sendOtp(base);
    const args = { phone: PHONE, code: sent[0]!.code, ipKey: 'ip1' };
    const results = await Promise.allSettled([verifyOtp(args), verifyOtp(args)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await db.session.count()).toBe(1);
  });

  it('refuses a disabled account', async () => {
    const sent = captureSms();
    await db.user.create({ data: { phone: PHONE, name: 'X', active: false } });
    await sendOtp(base);
    await expect(verifyOtp({ phone: PHONE, code: sent[0]!.code, ipKey: 'ip1' })).rejects.toMatchObject({ code: 'account_disabled' });
  });
});

describe('sessions', () => {
  async function login() {
    const sent = captureSms();
    await sendOtp(base);
    return verifyOtp({ phone: PHONE, code: sent[0]!.code, ipKey: 'ip1' });
  }

  it('stores only a hash of the token', async () => {
    const { token } = await login();
    const row = await db.session.findFirstOrThrow();
    expect(row.tokenHash).not.toBe(token);
    expect(JSON.stringify(row)).not.toContain(token);
    expect((await findSession(token))?.user.phone).toBe(PHONE);
  });

  it('rejects unknown, revoked, expired and idle sessions', async () => {
    expect(await findSession('nope')).toBeNull();
    const { token } = await login();
    const s = await db.session.findFirstOrThrow();

    await db.session.update({ where: { id: s.id }, data: { lastSeenAt: new Date(Date.now() - 15 * 86400_000) } });
    expect(await findSession(token)).toBeNull(); // idle > 14 days
    await db.session.update({ where: { id: s.id }, data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() - 1000) } });
    expect(await findSession(token)).toBeNull(); // expired
    await db.session.update({ where: { id: s.id }, data: { expiresAt: new Date(Date.now() + 1e6) } });
    expect(await findSession(token)).not.toBeNull();
    await revokeSession(s.id);
    expect(await findSession(token)).toBeNull(); // revoked
  });

  it('staff sessions are shorter than patient sessions', async () => {
    const u = await db.user.create({ data: { phone: '9000000001', name: 'Tech', role: 'TECHNICIAN' } });
    const { createSession } = await import('./session');
    const { token } = await createSession(u.id, 'TECHNICIAN');
    const s = await db.session.findFirstOrThrow({ where: { userId: u.id } });
    expect(s.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(12 * 3600_000 + 1000);
    await db.session.update({ where: { id: s.id }, data: { lastSeenAt: new Date(Date.now() - 5 * 3600_000) } });
    expect(await findSession(token)).toBeNull(); // idle > 4 h
  });

  it('a demoted or disabled user loses access immediately', async () => {
    const { token } = await login();
    await db.user.update({ where: { phone: PHONE }, data: { active: false } });
    expect(await findSession(token)).toBeNull();
  });
});

describe('auth routes', () => {
  async function call(mod: keyof typeof routes, r: Request) {
    const m = routes[mod] as { GET?: (r: NextRequest) => Promise<Response>; POST?: (r: NextRequest) => Promise<Response> };
    return (r.method === 'GET' ? m.GET! : m.POST!)(new NextRequest(r));
  }

  it('sets an httpOnly, SameSite=Lax cookie on login and clears it on logout', async () => {
    const send = await call('otp/send', req('/api/auth/otp/send', { body: { phone: '+91 98765 43210', name: 'Lakshmi Rao', consent: true } }));
    expect(send.status).toBe(200);
    const { devCode } = await send.json();

    const verify = await call('otp/verify', req('/api/auth/otp/verify', { body: { phone: PHONE, code: devCode } }));
    expect(verify.status).toBe(200);
    expect((await verify.json()).user.phone).toBe(PHONE);
    const cookie = [...jar.values()][0]!;
    expect(cookie.opts).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' });

    const me = await call('me', req('/api/auth/me', { method: 'GET' }));
    expect((await me.json()).user.name).toBe('Lakshmi Rao');

    const out = await call('logout', req('/api/auth/logout'));
    expect(out.status).toBe(200);
    expect(jar.size).toBe(0);
    expect(await db.session.count({ where: { revokedAt: null } })).toBe(0);
  });

  it('blocks cross-origin POSTs (CSRF)', async () => {
    const r = await call('otp/send', req('/api/auth/otp/send', { body: { phone: PHONE, name: 'Lakshmi Rao', consent: true }, headers: { origin: 'https://evil.example' } }));
    expect(r.status).toBe(403);
    expect(await db.otpRequest.count()).toBe(0);
  });

  it('blocks POSTs that carry no origin information at all', async () => {
    const r = new Request('http://localhost:3000/api/auth/otp/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: PHONE, name: 'Lakshmi Rao', consent: true }) });
    expect((await call('otp/send', r)).status).toBe(403);
  });

  it('validates input with field errors', async () => {
    const r = await call('otp/send', req('/api/auth/otp/send', { body: { phone: '12345', name: 'L', consent: true } }));
    expect(r.status).toBe(400);
    const j = await r.json();
    expect(j.error.fields.phone).toBeTruthy();
    expect(j.error.fields.name).toBeTruthy();
  });

  it('rejects malformed JSON without leaking internals', async () => {
    const r = new Request('http://localhost:3000/api/auth/otp/send', { method: 'POST', headers: { origin: 'http://localhost:3000' }, body: '{nope' });
    const res = await call('otp/send', r);
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).not.toMatch(/SyntaxError|at /);
  });
});

vi.setConfig({ testTimeout: 20000 });

describe('site-wide OTP ceiling', () => {
  it('refuses new codes once the hourly site-wide cap is hit, even for fresh numbers', async () => {
    await resetDb();
    await db.rateLimit.create({ data: { key: 'otp-global:' + (await import('../crypto')).hmac('rl', 'all').slice(0, 32), count: 1500, windowStart: new Date() } });
    await expect(sendOtp({ ...base, phone: '9123456780' })).rejects.toMatchObject({ status: 503, code: 'busy' });
    expect(await db.otpRequest.count()).toBe(0);
  });
});

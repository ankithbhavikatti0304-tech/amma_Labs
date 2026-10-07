import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { env, resetEnvCache } from './env';

const saved = { ...process.env };
const base = { DATABASE_URL: 'postgresql://x', APP_URL: 'https://ammalabs.example', APP_SECRET: 'x'.repeat(40) };
const prod = { ...base, NODE_ENV: 'production', SMS_PROVIDER: 'msg91', MSG91_AUTH_KEY: 'k', MSG91_OTP_TEMPLATE_ID: 't', PAYMENT_PROVIDER: 'razorpay', RAZORPAY_KEY_ID: 'a', RAZORPAY_KEY_SECRET: 'b', RAZORPAY_WEBHOOK_SECRET: 'c', STORAGE_DRIVER: 's3', S3_BUCKET: 'b', S3_ACCESS_KEY_ID: 'a', S3_SECRET_ACCESS_KEY: 's', CRON_SECRET: 'c'.repeat(32), TRUST_PROXY: 'true' };

function setEnv(vars: Record<string, string>) {
  process.env = { ...saved } as NodeJS.ProcessEnv;
  for (const k of Object.keys(process.env)) if (/^(SMS_|PAYMENT_|STORAGE_|S3_|MSG91|RAZORPAY|CRON|TRUST|ALLOW|WHATSAPP|DATABASE_URL|APP_)/.test(k)) delete process.env[k];
  Object.assign(process.env, vars);
  resetEnvCache();
}
beforeEach(() => resetEnvCache());
afterEach(() => { process.env = { ...saved }; resetEnvCache(); });

describe('environment validation', () => {
  it('a complete production configuration is accepted', () => {
    setEnv(prod);
    expect(env().NODE_ENV).toBe('production');
  });

  it('production refuses the development providers, each with a clear reason', () => {
    setEnv({ ...prod, SMS_PROVIDER: 'dev', PAYMENT_PROVIDER: 'mock', STORAGE_DRIVER: 'local' });
    expect(() => env()).toThrow(/SMS_PROVIDER[^\n]*OTPs on screen/);
    resetEnvCache();
    try { env(); } catch (e) { expect(String(e)).toMatch(/PAYMENT_PROVIDER/); expect(String(e)).toMatch(/STORAGE_DRIVER/); }
  });

  it('production needs https, a cron secret, and an explicit TRUST_PROXY decision', () => {
    setEnv({ ...prod, APP_URL: 'http://ammalabs.example' });
    expect(() => env()).toThrow(/APP_URL/);
    const { CRON_SECRET: _c, ...noCron } = prod;
    setEnv(noCron);
    expect(() => env()).toThrow(/CRON_SECRET/);
    const { TRUST_PROXY: _t, ...noProxy } = prod;
    setEnv(noProxy);
    expect(() => env()).toThrow(/TRUST_PROXY/);
  });

  it('a short secret is refused', () => {
    setEnv({ ...base, NODE_ENV: 'development', APP_URL: 'http://localhost:3000', APP_SECRET: 'short' });
    expect(() => env()).toThrow(/APP_SECRET/);
  });

  it('a provider that is switched on must have its keys', () => {
    setEnv({ ...base, NODE_ENV: 'development', APP_URL: 'http://localhost:3000', PAYMENT_PROVIDER: 'razorpay' });
    expect(() => env()).toThrow(/RAZORPAY_KEY_ID/);
  });

  it('development works with nothing but the basics', () => {
    setEnv({ ...base, NODE_ENV: 'development', APP_URL: 'http://localhost:3000' });
    expect(env()).toMatchObject({ SMS_PROVIDER: 'dev', PAYMENT_PROVIDER: 'mock', STORAGE_DRIVER: 'local' });
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import { resetEnvCache } from './env';
import { assertSameOrigin } from './http';

const saved = { ...process.env };
const base = { NODE_ENV: 'production', DATABASE_URL: 'postgresql://x', APP_SECRET: 'x'.repeat(40), APP_URL: 'https://ammalabs.example', SMS_PROVIDER: 'msg91', MSG91_AUTH_KEY: 'k', MSG91_OTP_TEMPLATE_ID: 't', PAYMENT_PROVIDER: 'none', STORAGE_DRIVER: 's3', S3_BUCKET: 'b', S3_ACCESS_KEY_ID: 'a', S3_SECRET_ACCESS_KEY: 's', CRON_SECRET: 'c'.repeat(32), TRUST_PROXY: 'true' };

function setEnv(vars: Record<string, string>) {
  process.env = { ...saved } as NodeJS.ProcessEnv;
  for (const k of Object.keys(process.env)) if (/^(SMS_|PAYMENT_|STORAGE_|S3_|MSG91|CRON|TRUST|ALLOW|DATABASE_URL|APP_|VERCEL)/.test(k)) delete process.env[k];
  Object.assign(process.env, vars);
  resetEnvCache();
}
afterEach(() => { process.env = { ...saved }; resetEnvCache(); });

const post = (headers: Record<string, string>) => new Request('https://ammalabs.example/api/x', { method: 'POST', headers });
const preview = { ...base, VERCEL_ENV: 'preview', VERCEL_URL: 'amma-labs-abc123-team.vercel.app', VERCEL_BRANCH_URL: 'amma-labs-git-feature-team.vercel.app' };

describe('same-origin check', () => {
  it('accepts the site\'s own origin and refuses any other', () => {
    setEnv(base);
    expect(() => assertSameOrigin(post({ origin: 'https://ammalabs.example' }))).not.toThrow();
    expect(() => assertSameOrigin(post({ origin: 'https://evil.example' }))).toThrow(/Request blocked/);
  });

  it('with no Origin header, needs Sec-Fetch-Site to say same-origin or none', () => {
    setEnv(base);
    expect(() => assertSameOrigin(post({ 'sec-fetch-site': 'same-origin' }))).not.toThrow();
    expect(() => assertSameOrigin(post({ 'sec-fetch-site': 'cross-site' }))).toThrow(/Request blocked/);
    expect(() => assertSameOrigin(post({}))).toThrow(/Request blocked/);
  });

  it('on a preview deployment, its own deployment and branch addresses are accepted, others are not', () => {
    setEnv(preview);
    expect(() => assertSameOrigin(post({ origin: 'https://amma-labs-abc123-team.vercel.app' }))).not.toThrow();
    expect(() => assertSameOrigin(post({ origin: 'https://amma-labs-git-feature-team.vercel.app' }))).not.toThrow();
    expect(() => assertSameOrigin(post({ origin: 'https://amma-labs-other-team.vercel.app' }))).toThrow(/Request blocked/);
    expect(() => assertSameOrigin(post({ origin: 'http://amma-labs-abc123-team.vercel.app' }))).toThrow(/Request blocked/);
  });

  it('on production the Vercel addresses mean nothing, even if the variables are present', () => {
    setEnv({ ...preview, VERCEL_ENV: 'production' });
    expect(() => assertSameOrigin(post({ origin: 'https://amma-labs-abc123-team.vercel.app' }))).toThrow(/Request blocked/);
  });

  it('the preview addresses come from the environment, never from the request', () => {
    setEnv(preview);
    expect(() => assertSameOrigin(post({ origin: 'https://evil.example', host: 'evil.example', 'x-forwarded-host': 'evil.example' }))).toThrow(/Request blocked/);
  });
});

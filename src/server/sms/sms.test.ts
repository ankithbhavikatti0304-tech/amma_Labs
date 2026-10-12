import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetEnvCache } from '../env';
import { setSmsProvider, sms } from './index';

const saved = { ...process.env };
const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  process.env = { ...saved, NODE_ENV: 'test', DATABASE_URL: 'postgresql://x', APP_URL: 'http://localhost:3000', APP_SECRET: 'x'.repeat(40), SMS_PROVIDER: 'msg91', MSG91_AUTH_KEY: 'k', MSG91_OTP_TEMPLATE_ID: 't' } as NodeJS.ProcessEnv;
  resetEnvCache();
  setSmsProvider(undefined);
});
afterEach(() => {
  process.env = { ...saved };
  resetEnvCache();
  setSmsProvider(undefined);
  vi.restoreAllMocks();
});

describe('MSG91 sender', () => {
  it('sends the code as VAR1 to the 91-prefixed number and returns nothing to show on screen', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok({ type: 'success', message: 'abc' }));
    await expect(sms().sendOtp('9000000001', '123456')).resolves.toEqual({});
    const [, init] = f.mock.calls[0]!;
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ template_id: 't', recipients: [{ mobiles: '919000000001', VAR1: '123456' }] });
  });

  it('fails when the gateway answers 200 but says error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok({ type: 'error', message: 'Template not found' }));
    await expect(sms().sendOtp('9000000001', '123456')).rejects.toThrow(/SMS gateway/);
  });

  it('fails on an HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok({}, 401));
    await expect(sms().sendOtp('9000000001', '123456')).rejects.toThrow(/401/);
  });
});

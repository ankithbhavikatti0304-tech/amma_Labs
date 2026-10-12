import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetEnvCache } from '../env';
import { email, loginMessage, parseFrom, setEmailProvider } from './index';

const saved = { ...process.env };
const respond = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function setEnv(vars: Record<string, string>) {
  process.env = { ...saved, NODE_ENV: 'test', DATABASE_URL: 'postgresql://x', APP_URL: 'http://localhost:3000', APP_SECRET: 'x'.repeat(40), ...vars } as NodeJS.ProcessEnv;
  resetEnvCache();
  setEmailProvider(undefined);
}
beforeEach(() => setEnv({}));
afterEach(() => {
  process.env = { ...saved };
  resetEnvCache();
  setEmailProvider(undefined);
  vi.restoreAllMocks();
});

describe('login message', () => {
  it('carries the code and the lifetime, and nothing else personal', () => {
    const m = loginMessage('123456');
    expect(m.subject).toBe('Your Amma Labs login code');
    expect(m.text).toContain('123456');
    expect(m.html).toContain('123456');
    expect(m.text).toContain('5 minutes');
    expect(m.text).not.toMatch(/https?:\/\//);
  });
});

describe('parseFrom', () => {
  it('splits a display name from the address', () => {
    expect(parseFrom('Amma Labs <login@ammalabs.in>')).toEqual({ name: 'Amma Labs', email: 'login@ammalabs.in' });
    expect(parseFrom('"Amma Labs" <login@ammalabs.in>')).toEqual({ name: 'Amma Labs', email: 'login@ammalabs.in' });
    expect(parseFrom('login@ammalabs.in')).toEqual({ name: null, email: 'login@ammalabs.in' });
  });
});

describe('dev provider', () => {
  it('hands the code back so the screen can show it', async () => {
    await expect(email().sendLoginCode('a@b.co', '654321')).resolves.toEqual({ devCode: '654321' });
  });
});

describe('Resend', () => {
  beforeEach(() => setEnv({ EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 'key_1', EMAIL_FROM: 'Amma Labs <login@ammalabs.in>' }));

  it('posts the message with the key and returns nothing to show', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(respond(200, { id: 'x' }));
    await expect(email().sendLoginCode('lakshmi@example.com', '123456')).resolves.toEqual({});
    const [url, init] = f.mock.calls[0]!;
    expect(String(url)).toBe('https://api.resend.com/emails');
    expect((init as RequestInit).headers).toMatchObject({ authorization: 'Bearer key_1' });
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body).toMatchObject({ from: 'Amma Labs <login@ammalabs.in>', to: ['lakshmi@example.com'], subject: 'Your Amma Labs login code' });
    expect(body.text).toContain('123456');
  });

  it('fails when the gateway refuses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(respond(403, { message: 'domain not verified' }));
    await expect(email().sendLoginCode('a@b.co', '123456')).rejects.toThrow(/403/);
  });
});

describe('Brevo', () => {
  beforeEach(() => setEnv({ EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'bk_1', EMAIL_FROM: 'Amma Labs <login@ammalabs.in>' }));

  it('posts the message with the api-key header and a split sender', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(respond(201, { messageId: 'm' }));
    await expect(email().sendLoginCode('lakshmi@example.com', '123456')).resolves.toEqual({});
    const [url, init] = f.mock.calls[0]!;
    expect(String(url)).toBe('https://api.brevo.com/v3/smtp/email');
    expect((init as RequestInit).headers).toMatchObject({ 'api-key': 'bk_1' });
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body).toMatchObject({ sender: { name: 'Amma Labs', email: 'login@ammalabs.in' }, to: [{ email: 'lakshmi@example.com' }], subject: 'Your Amma Labs login code' });
    expect(body.textContent).toContain('123456');
  });

  it('fails when the gateway refuses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(respond(401));
    await expect(email().sendLoginCode('a@b.co', '123456')).rejects.toThrow(/401/);
  });
});

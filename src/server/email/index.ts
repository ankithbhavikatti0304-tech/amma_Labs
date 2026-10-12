import 'server-only';
import { env } from '../env';
import { log } from '../log';
import { OTP } from '@/config/lab';

export interface EmailProvider {
  /**
   * Email a login code. Throws if the provider refuses it. The dev provider returns the code so the
   * UI can show it ("demo mode"); real providers return nothing.
   */
  sendLoginCode(to: string, code: string): Promise<{ devCode?: string }>;
}

/** The message. Only the code and how long it lasts: no links to click, no personal details. */
export function loginMessage(code: string): { subject: string; text: string; html: string } {
  const minutes = Math.round(OTP.ttlSeconds / 60);
  const text = `Your Amma Labs login code is ${code}\n\nIt works for ${minutes} minutes. Please do not share it with anyone.\nIf you did not ask for this code, you can ignore this email.\n\nAmma Labs — Tested with a mother's care.`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#0F2236">
<p style="margin:0 0 8px">Your Amma Labs login code is</p>
<p style="font-size:32px;letter-spacing:6px;font-weight:700;margin:0 0 16px;color:#3368A0">${code}</p>
<p style="margin:0 0 8px;font-size:14px">It works for ${minutes} minutes. Please do not share it with anyone.</p>
<p style="margin:0 0 16px;font-size:14px;color:#556">If you did not ask for this code, you can ignore this email.</p>
<p style="margin:0;font-size:13px;color:#556">Amma Labs — Tested with a mother&#39;s care.</p></div>`;
  return { subject: 'Your Amma Labs login code', text, html };
}

/** `Amma Labs <login@x.in>` → { name, email }. A bare address has no name. */
export function parseFrom(from: string): { name: string | null; email: string } {
  const m = /^\s*(?:"?([^"<]*?)"?\s*)?<([^<>\s]+)>\s*$/.exec(from);
  return m ? { name: m[1]?.trim() || null, email: m[2]! } : { name: null, email: from.trim() };
}

class DevEmail implements EmailProvider {
  async sendLoginCode(_to: string, code: string) {
    // Not logged: login codes never go to logs. env.ts refuses this provider in production.
    return { devCode: code };
  }
}

/** Resend (resend.com). Needs a verified sending domain to reach anyone but the account owner. */
class ResendEmail implements EmailProvider {
  async sendLoginCode(to: string, code: string) {
    const e = env();
    const m = loginMessage(code);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${e.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: e.EMAIL_FROM, to: [to], subject: m.subject, text: m.text, html: m.html }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      log.error('resend send failed', { status: res.status });
      throw new Error(`Email gateway returned ${res.status}`);
    }
    return {};
  }
}

/** Brevo (brevo.com). Needs the sender address verified in the Brevo account. */
class BrevoEmail implements EmailProvider {
  async sendLoginCode(to: string, code: string) {
    const e = env();
    const m = loginMessage(code);
    const from = parseFrom(e.EMAIL_FROM!);
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': e.BREVO_API_KEY!, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: { ...(from.name ? { name: from.name } : {}), email: from.email }, to: [{ email: to }], subject: m.subject, textContent: m.text, htmlContent: m.html }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      log.error('brevo send failed', { status: res.status });
      throw new Error(`Email gateway returned ${res.status}`);
    }
    return {};
  }
}

let provider: EmailProvider | undefined;
export function email(): EmailProvider {
  if (provider) return provider;
  const p = env().EMAIL_PROVIDER;
  return (provider = p === 'resend' ? new ResendEmail() : p === 'brevo' ? new BrevoEmail() : new DevEmail());
}

/** Tests swap the provider. */
export function setEmailProvider(p: EmailProvider | undefined) {
  provider = p;
}

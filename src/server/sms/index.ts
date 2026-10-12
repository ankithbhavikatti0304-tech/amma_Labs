import 'server-only';
import { env } from '../env';
import { log } from '../log';

export interface SmsProvider {
  /**
   * Deliver an OTP. Throws if the carrier/gateway rejects it. The dev provider returns the
   * code so the UI can show it (the prototype's "demo mode"); real providers return nothing.
   */
  sendOtp(phone: string, code: string): Promise<{ devCode?: string }>;
}

class DevSms implements SmsProvider {
  async sendOtp(_phone: string, code: string) {
    // Not logged: OTPs never go to logs. env.ts refuses this provider in production.
    return { devCode: code };
  }
}

/**
 * MSG91 Flow API. Indian SMS needs a DLT-registered sender and template; the template must
 * expose one variable named VAR1 (written ##VAR1## in the template text) for the code.
 * NOTE: written against MSG91's documented Flow API but not exercised against the live
 * service from CI — send one real OTP in staging before launch.
 */
class Msg91Sms implements SmsProvider {
  async sendOtp(phone: string, code: string) {
    const e = env();
    const res = await fetch('https://control.msg91.com/api/v5/flow', {
      method: 'POST',
      headers: { authkey: e.MSG91_AUTH_KEY!, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ template_id: e.MSG91_OTP_TEMPLATE_ID, recipients: [{ mobiles: `91${phone}`, VAR1: code }] }),
      signal: AbortSignal.timeout(8000),
    });
    // MSG91 can answer 200 with {"type":"error"} (bad template, no credit, number blocked). Treat that as a failure too,
    // or the patient is told a code was sent when it was not. The message text is not logged.
    const body = (await res.json().catch(() => null)) as { type?: string } | null;
    if (!res.ok || body?.type === 'error') {
      log.error('msg91 send failed', { status: res.status, type: body?.type });
      throw new Error(`SMS gateway returned ${res.ok ? 'an error' : res.status}`);
    }
    return {};
  }
}

let provider: SmsProvider | undefined;
export function sms(): SmsProvider {
  return (provider ??= env().SMS_PROVIDER === 'msg91' ? new Msg91Sms() : new DevSms());
}

/** Tests swap the provider. */
export function setSmsProvider(p: SmsProvider | undefined) {
  provider = p;
}

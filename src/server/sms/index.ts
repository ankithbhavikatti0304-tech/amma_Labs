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
 * expose one variable (VAR1 here) for the code.
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
    if (!res.ok) {
      log.error('msg91 send failed', { status: res.status });
      throw new Error(`SMS gateway returned ${res.status}`);
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

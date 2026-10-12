import 'server-only';
import { createHmac, randomUUID } from 'node:crypto';
import { env } from '../env';
import { hmac, safeEqual } from '../crypto';
import { log } from '../log';
import { ApiError } from '../http-errors';

export interface GatewayOrder {
  providerOrderId: string;
  /** Public key the browser needs to open checkout. */
  keyId?: string;
  /** Only the mock gateway: the signature its "Pay" button submits. Never returned by a real gateway. */
  devSignature?: string;
}

export interface PaymentProvider {
  readonly name: 'razorpay' | 'mock';
  /** Ask the gateway for a payable order. `amountPaise` is whole paise. */
  createOrder(args: { amountPaise: number; receipt: string }): Promise<GatewayOrder>;
  /** What the browser needs to resume checkout for an order we already created. */
  publicInfo(providerOrderId: string): { keyId?: string; devSignature?: string };
  /** Check the signature the browser hands back after checkout succeeds. */
  verifyCheckout(args: { providerOrderId: string; paymentId: string; signature: string }): boolean;
  /** Check a webhook really came from the gateway. `raw` must be the exact request body. */
  verifyWebhook(raw: string, signature: string): boolean;
}

class RazorpayProvider implements PaymentProvider {
  readonly name = 'razorpay' as const;
  async createOrder({ amountPaise, receipt }: { amountPaise: number; receipt: string }): Promise<GatewayOrder> {
    const e = env();
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Basic ${Buffer.from(`${e.RAZORPAY_KEY_ID}:${e.RAZORPAY_KEY_SECRET}`).toString('base64')}` },
      body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt, notes: { orderCode: receipt } }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      log.error('razorpay create order failed', { status: res.status });
      throw new Error(`Razorpay returned ${res.status}`);
    }
    const j = (await res.json()) as { id: string };
    return { providerOrderId: j.id, keyId: e.RAZORPAY_KEY_ID };
  }
  publicInfo() {
    return { keyId: env().RAZORPAY_KEY_ID };
  }
  verifyCheckout({ providerOrderId, paymentId, signature }: { providerOrderId: string; paymentId: string; signature: string }) {
    const expected = createHmac('sha256', env().RAZORPAY_KEY_SECRET!).update(`${providerOrderId}|${paymentId}`).digest('hex');
    return safeEqual(expected, signature);
  }
  verifyWebhook(raw: string, signature: string) {
    const expected = createHmac('sha256', env().RAZORPAY_WEBHOOK_SECRET!).update(raw).digest('hex');
    return safeEqual(expected, signature);
  }
}

/** Stands in for a gateway on a laptop and in tests. env.ts refuses it in production. No money moves. */
class MockProvider implements PaymentProvider {
  readonly name = 'mock' as const;
  private sig = (orderId: string, paymentId: string) => hmac('mock-pay', `${orderId}|${paymentId}`);
  publicInfo(providerOrderId: string) {
    return { devSignature: this.sig(providerOrderId, `pay_${providerOrderId.slice(5)}`) };
  }
  async createOrder(_args: { amountPaise: number; receipt: string }): Promise<GatewayOrder> {
    const providerOrderId = `mock_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
    return { providerOrderId, devSignature: this.sig(providerOrderId, `pay_${providerOrderId.slice(5)}`) };
  }
  verifyCheckout({ providerOrderId, paymentId, signature }: { providerOrderId: string; paymentId: string; signature: string }) {
    return safeEqual(this.sig(providerOrderId, paymentId), signature);
  }
  verifyWebhook(raw: string, signature: string) {
    return safeEqual(hmac('mock-webhook', raw), signature);
  }
}

let provider: PaymentProvider | undefined;
/** False when PAYMENT_PROVIDER=none: the lab takes payment at collection only. */
export const onlinePaymentsEnabled = () => env().PAYMENT_PROVIDER !== 'none';

export const payments = (): PaymentProvider => {
  if (provider) return provider;
  const p = env().PAYMENT_PROVIDER;
  if (p === 'none') throw new ApiError(404, 'online_payment_off', 'Online payment is not available. Please pay at collection.');
  return (provider = p === 'razorpay' ? new RazorpayProvider() : new MockProvider());
};
export const _setPaymentProvider = (p: PaymentProvider | undefined) => { provider = p; };
export const mockWebhookSignature = (raw: string) => hmac('mock-webhook', raw);

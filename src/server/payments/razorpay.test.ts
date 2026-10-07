import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { _setPaymentProvider, payments } from './index';
import { resetEnvCache } from '../env';

const SECRET = 'rzp_test_secret_value_1234567890';
const WEBHOOK = 'whsec_test_value_1234567890abcdef';
const saved = { ...process.env };

beforeEach(() => {
  Object.assign(process.env, {
    NODE_ENV: 'test', DATABASE_URL: 'postgresql://x', APP_URL: 'http://localhost:3000', APP_SECRET: 'x'.repeat(40),
    PAYMENT_PROVIDER: 'razorpay', RAZORPAY_KEY_ID: 'rzp_test_abc', RAZORPAY_KEY_SECRET: SECRET, RAZORPAY_WEBHOOK_SECRET: WEBHOOK,
  });
  resetEnvCache();
  _setPaymentProvider(undefined);
});
afterEach(() => {
  process.env = { ...saved };
  resetEnvCache();
  _setPaymentProvider(undefined);
});

describe('Razorpay signatures (as documented by Razorpay)', () => {
  it('accepts HMAC-SHA256(order_id|payment_id, key_secret) and nothing else', () => {
    const p = payments();
    expect(p.name).toBe('razorpay');
    const good = createHmac('sha256', SECRET).update('order_ABC|pay_XYZ').digest('hex');
    expect(p.verifyCheckout({ providerOrderId: 'order_ABC', paymentId: 'pay_XYZ', signature: good })).toBe(true);
    expect(p.verifyCheckout({ providerOrderId: 'order_ABC', paymentId: 'pay_OTHER', signature: good })).toBe(false); // a different payment
    expect(p.verifyCheckout({ providerOrderId: 'order_OTHER', paymentId: 'pay_XYZ', signature: good })).toBe(false); // a different order
    expect(p.verifyCheckout({ providerOrderId: 'order_ABC', paymentId: 'pay_XYZ', signature: good.slice(0, -1) + (good.endsWith('0') ? '1' : '0') })).toBe(false);
    expect(p.verifyCheckout({ providerOrderId: 'order_ABC', paymentId: 'pay_XYZ', signature: '' })).toBe(false);
    // signed with the webhook secret instead of the key secret: no
    expect(p.verifyCheckout({ providerOrderId: 'order_ABC', paymentId: 'pay_XYZ', signature: createHmac('sha256', WEBHOOK).update('order_ABC|pay_XYZ').digest('hex') })).toBe(false);
  });

  it('verifies webhooks over the exact raw body with the webhook secret', () => {
    const p = payments();
    const body = '{"event":"payment.captured","payload":{}}';
    const sig = createHmac('sha256', WEBHOOK).update(body).digest('hex');
    expect(p.verifyWebhook(body, sig)).toBe(true);
    expect(p.verifyWebhook(body + ' ', sig)).toBe(false); // a single changed byte
    expect(p.verifyWebhook(body, createHmac('sha256', SECRET).update(body).digest('hex'))).toBe(false);
  });

  it('only exposes the public key id', () => {
    expect(payments().publicInfo('order_ABC')).toEqual({ keyId: 'rzp_test_abc' });
  });
});

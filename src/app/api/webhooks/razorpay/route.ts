import { api, ApiError } from '@/server/http';
import { handleWebhook } from '@/server/payments/service';

/**
 * Razorpay → us. No cookies here: the request is trusted only if its signature matches the
 * exact bytes received. Always answers 200 for events we choose to ignore, so the gateway doesn't keep retrying them.
 */
export const POST = api({ skipCsrf: true }, async ({ req }) => {
  const raw = await req.text();
  if (raw.length > 200_000) throw new ApiError(413, 'too_large', 'Too large.');
  return handleWebhook(raw, req.headers.get('x-razorpay-signature') ?? '', req.headers.get('x-razorpay-event-id'));
});

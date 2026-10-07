import { z } from 'zod';
import { api } from '@/server/http';
import { confirmCheckout } from '@/server/payments/service';
import { orderCode } from '@/server/schemas';

const schema = z.object({ providerOrderId: z.string().min(5).max(80), paymentId: z.string().min(5).max(80), signature: z.string().min(10).max(200) });

export const POST = api<typeof schema, undefined, { code: string }>({ auth: 'user', body: schema, limit: { name: 'pay-verify', max: 30, windowSec: 3600 } }, async ({ user, body, params }) => confirmCheckout(user, orderCode.parse(params.code), body));

import { api, ApiError } from '@/server/http';
import { createOrder, listOrders } from '@/server/orders';
import { createOrderSchema } from '@/server/schemas';

export const GET = api({ auth: 'user' }, async ({ user }) => ({ orders: await listOrders(user.id) }));

export const POST = api({ auth: 'user', body: createOrderSchema, limit: { name: 'order-create', max: 12, windowSec: 3600 } }, async ({ req, body, user }) => {
  // A fresh key per checkout attempt. Retrying with the same key can never create a second order.
  const key = req.headers.get('idempotency-key');
  if (!key || !/^[A-Za-z0-9-]{16,64}$/.test(key)) throw new ApiError(400, 'idempotency_key', 'Missing Idempotency-Key header.');
  const order = await createOrder(user, { ...body, address: body.address ?? null, coupon: body.coupon ?? null, idempotencyKey: key });
  return { order };
});

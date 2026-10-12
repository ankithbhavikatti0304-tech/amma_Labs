import { api } from '@/server/http';
import { cancelOrder } from '@/server/orders';
import { orderCode } from '@/server/schemas';

export const POST = api<undefined, undefined, { code: string }>({ auth: 'user', limit: { name: 'order-cancel', max: 20, windowSec: 3600 } }, async ({ user, params }) => ({ order: await cancelOrder(user, orderCode.parse(params.code)) }));

import { api } from '@/server/http';
import { getOrderFor } from '@/server/orders';
import { orderCode } from '@/server/schemas';

export const GET = api<undefined, undefined, { code: string }>({ auth: 'user' }, async ({ user, params }) => ({ order: await getOrderFor(user, orderCode.parse(params.code)) }));

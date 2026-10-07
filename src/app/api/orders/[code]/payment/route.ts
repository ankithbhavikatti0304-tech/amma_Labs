import { api } from '@/server/http';
import { initPayment } from '@/server/payments/service';
import { orderCode } from '@/server/schemas';

export const POST = api<undefined, undefined, { code: string }>({ auth: 'user', limit: { name: 'pay-init', max: 20, windowSec: 3600 } }, async ({ user, params }) => initPayment(user, orderCode.parse(params.code)));

import { api } from '@/server/http';
import { adminCancel } from '@/server/staff';
import { orderCode, reasonSchema } from '@/server/schemas';

export const POST = api<typeof reasonSchema, undefined, { code: string }>({ auth: ['ADMIN'], body: reasonSchema }, async ({ user, body, params }) => {
  await adminCancel(user, orderCode.parse(params.code), body.reason);
  return { ok: true };
});

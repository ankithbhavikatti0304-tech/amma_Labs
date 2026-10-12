import { api } from '@/server/http';
import { reopenReport } from '@/server/results';
import { orderCode, reasonSchema } from '@/server/schemas';

export const POST = api<typeof reasonSchema, undefined, { code: string }>({ auth: ['ADMIN'], body: reasonSchema }, async ({ user, body, params }) => {
  await reopenReport(user, orderCode.parse(params.code), body.reason);
  return { ok: true };
});

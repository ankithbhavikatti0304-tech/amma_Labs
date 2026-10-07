import { api } from '@/server/http';
import { assignPhlebotomist } from '@/server/staff';
import { assignSchema, orderCode } from '@/server/schemas';

export const POST = api<typeof assignSchema, undefined, { code: string }>({ auth: ['ADMIN'], body: assignSchema }, async ({ user, body, params }) => {
  await assignPhlebotomist(user, orderCode.parse(params.code), body.phlebotomistId);
  return { ok: true };
});

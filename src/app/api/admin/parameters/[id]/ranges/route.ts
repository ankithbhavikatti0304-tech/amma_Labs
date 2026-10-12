import { api } from '@/server/http';
import { addRange } from '@/server/admin';
import { rangeSchema } from '@/server/admin-schemas';

export const POST = api<typeof rangeSchema, undefined, { id: string }>({ auth: ['ADMIN'], body: rangeSchema }, async ({ user, body, params }) => {
  await addRange(user, params.id, body);
  return { ok: true };
});

import { api } from '@/server/http';
import { updateTest } from '@/server/admin';
import { testSchema } from '@/server/admin-schemas';

export const PATCH = api<typeof testSchema, undefined, { id: string }>({ auth: ['ADMIN'], body: testSchema }, async ({ user, body, params }) => {
  await updateTest(user, params.id, body);
  return { ok: true };
});

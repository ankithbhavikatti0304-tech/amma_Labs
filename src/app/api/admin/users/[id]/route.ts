import { api } from '@/server/http';
import { setUserActive } from '@/server/admin';
import { activeSchema } from '@/server/admin-schemas';

export const PATCH = api<typeof activeSchema, undefined, { id: string }>({ auth: ['ADMIN'], body: activeSchema }, async ({ user, body, params }) => {
  await setUserActive(user, params.id, body.active);
  return { ok: true };
});

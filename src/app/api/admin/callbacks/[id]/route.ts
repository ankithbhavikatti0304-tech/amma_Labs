import { api } from '@/server/http';
import { updateCallback } from '@/server/admin';
import { callbackSchema } from '@/server/admin-schemas';

export const PATCH = api<typeof callbackSchema, undefined, { id: string }>({ auth: ['ADMIN'], body: callbackSchema }, async ({ user, body, params }) => {
  await updateCallback(user, params.id, body);
  return { ok: true };
});

import { api } from '@/server/http';
import { updateParameter } from '@/server/admin';
import { parameterSchema } from '@/server/admin-schemas';

export const PATCH = api<typeof parameterSchema, undefined, { id: string }>({ auth: ['ADMIN'], body: parameterSchema }, async ({ user, body, params }) => {
  await updateParameter(user, params.id, body);
  return { ok: true };
});

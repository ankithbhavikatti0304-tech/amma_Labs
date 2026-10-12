import { api } from '@/server/http';
import { setTestParameters } from '@/server/admin';
import { testParametersSchema } from '@/server/admin-schemas';

export const PUT = api<typeof testParametersSchema, undefined, { id: string }>({ auth: ['ADMIN'], body: testParametersSchema }, async ({ user, body, params }) => {
  await setTestParameters(user, params.id, body.items);
  return { ok: true };
});

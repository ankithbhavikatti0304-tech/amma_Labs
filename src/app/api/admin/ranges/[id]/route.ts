import { api } from '@/server/http';
import { deleteRange } from '@/server/admin';

export const DELETE = api<undefined, undefined, { id: string }>({ auth: ['ADMIN'] }, async ({ user, params }) => {
  await deleteRange(user, params.id);
  return { ok: true };
});

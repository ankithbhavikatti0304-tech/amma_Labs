import { api } from '@/server/http';
import { removePatient } from '@/server/account';

export const DELETE = api<undefined, undefined, { id: string }>({ auth: 'user' }, async ({ user, params }) => {
  await removePatient(user.id, params.id);
  return { ok: true };
});

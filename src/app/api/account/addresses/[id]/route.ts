import { api } from '@/server/http';
import { removeAddress } from '@/server/account';

export const DELETE = api<undefined, undefined, { id: string }>({ auth: 'user' }, async ({ user, params }) => {
  await removeAddress(user.id, params.id);
  return { ok: true };
});

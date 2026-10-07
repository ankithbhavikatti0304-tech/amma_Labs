import { api } from '@/server/http';
import { requestDeletion } from '@/server/account';

export const POST = api({ auth: 'user', limit: { name: 'delete-request', max: 3, windowSec: 86_400 } }, async ({ user }) => {
  await requestDeletion(user);
  return { ok: true };
});

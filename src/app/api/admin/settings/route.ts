import { api } from '@/server/http';
import { updateSettings } from '@/server/admin';
import { settingsSchema } from '@/server/admin-schemas';

export const PUT = api({ auth: ['ADMIN'], body: settingsSchema }, async ({ user, body }) => {
  await updateSettings(user, body);
  return { ok: true };
});

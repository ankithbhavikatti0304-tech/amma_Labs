import { api } from '@/server/http';
import { updateSlot } from '@/server/admin';
import { slotSchema } from '@/server/admin-schemas';

export const PATCH = api<typeof slotSchema, undefined, { id: string }>({ auth: ['ADMIN'], body: slotSchema }, async ({ user, body, params }) => {
  await updateSlot(user, params.id, body);
  return { ok: true };
});

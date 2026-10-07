import { api } from '@/server/http';
import { updatePrescription } from '@/server/admin';
import { prescriptionSchema } from '@/server/admin-schemas';

export const PATCH = api<typeof prescriptionSchema, undefined, { id: string }>({ auth: ['ADMIN'], body: prescriptionSchema }, async ({ user, body, params }) => {
  await updatePrescription(user, params.id, body);
  return { ok: true };
});

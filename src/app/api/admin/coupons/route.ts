import { api } from '@/server/http';
import { createCoupon } from '@/server/admin';
import { couponCreateSchema } from '@/server/admin-schemas';

export const POST = api({ auth: ['ADMIN'], body: couponCreateSchema }, async ({ user, body }) => {
  await createCoupon(user, body);
  return { ok: true };
});

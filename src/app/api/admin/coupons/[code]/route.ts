import { api } from '@/server/http';
import { updateCoupon } from '@/server/admin';
import { couponBase } from '@/server/admin-schemas';

export const PATCH = api<typeof couponBase, undefined, { code: string }>({ auth: ['ADMIN'], body: couponBase }, async ({ user, body, params }) => {
  await updateCoupon(user, params.code, body);
  return { ok: true };
});

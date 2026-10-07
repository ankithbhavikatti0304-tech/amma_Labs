import { z } from 'zod';
import { api } from '@/server/http';
import { requestCallback } from '@/server/callbacks';
import { personName, phoneSchema } from '@/server/schemas';
import { getUser } from '@/server/auth/cookie';

const schema = z.object({ phone: phoneSchema, name: personName.optional() });

export const POST = api({ body: schema }, async ({ body, ipKey }) => {
  const user = await getUser();
  await requestCallback({ ...body, userId: user?.id, ipKey });
  return { ok: true };
});

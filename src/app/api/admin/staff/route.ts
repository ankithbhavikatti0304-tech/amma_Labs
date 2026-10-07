import { api } from '@/server/http';
import { upsertStaff } from '@/server/admin';
import { staffSchema } from '@/server/admin-schemas';

export const POST = api({ auth: ['ADMIN'], body: staffSchema }, async ({ user, body }) => upsertStaff(user, body));

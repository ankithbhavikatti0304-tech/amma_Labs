import { api } from '@/server/http';
import { createParameter } from '@/server/admin';
import { parameterSchema } from '@/server/admin-schemas';

export const POST = api({ auth: ['ADMIN'], body: parameterSchema }, async ({ user, body }) => createParameter(user, body));

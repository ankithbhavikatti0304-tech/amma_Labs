import { api } from '@/server/http';
import { createTest } from '@/server/admin';
import { testSchema } from '@/server/admin-schemas';

export const POST = api({ auth: ['ADMIN'], body: testSchema }, async ({ user, body }) => createTest(user, body));

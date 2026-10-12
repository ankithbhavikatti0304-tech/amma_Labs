import { api } from '@/server/http';
import { getUser } from '@/server/auth/cookie';

export const GET = api({}, async () => ({ user: await getUser() }));

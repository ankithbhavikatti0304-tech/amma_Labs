import { api } from '@/server/http';
import { clearSessionCookie, getSession } from '@/server/auth/cookie';
import { revokeSession } from '@/server/auth/session';

export const POST = api({}, async () => {
  const s = await getSession();
  if (s) await revokeSession(s.sessionId);
  await clearSessionCookie();
  return { ok: true };
});

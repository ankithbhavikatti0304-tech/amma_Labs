import { api } from '@/server/http';
import { verifyOtp } from '@/server/auth/otp';
import { setSessionCookie } from '@/server/auth/cookie';
import { verifyOtpSchema } from '@/server/schemas';

export const POST = api({ body: verifyOtpSchema }, async ({ req, body, ipKey }) => {
  const login = await verifyOtp({ ...body, ipKey, userAgent: req.headers.get('user-agent') });
  await setSessionCookie(login.token, login.expiresAt);
  return { user: login.user };
});

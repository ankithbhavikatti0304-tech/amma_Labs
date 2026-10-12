import { api, ApiError } from '@/server/http';
import { env } from '@/server/env';
import { verifyEmailOtp } from '@/server/auth/email-otp';
import { setSessionCookie } from '@/server/auth/cookie';
import { verifyEmailOtpSchema } from '@/server/schemas';

export const POST = api({ body: verifyEmailOtpSchema }, async ({ req, body, ipKey }) => {
  if (env().LOGIN_METHOD !== 'email') throw new ApiError(404, 'not_found', 'Not found.');
  const login = await verifyEmailOtp({ ...body, ipKey, userAgent: req.headers.get('user-agent') });
  await setSessionCookie(login.token, login.expiresAt);
  return { user: login.user };
});

import { api, ApiError } from '@/server/http';
import { env } from '@/server/env';
import { verifyOtp } from '@/server/auth/otp';
import { setSessionCookie } from '@/server/auth/cookie';
import { verifyOtpSchema } from '@/server/schemas';

export const POST = api({ body: verifyOtpSchema }, async ({ req, body, ipKey }) => {
  if (env().LOGIN_METHOD !== 'phone') throw new ApiError(404, 'not_found', 'Not found.');
  const login = await verifyOtp({ ...body, ipKey, userAgent: req.headers.get('user-agent') });
  await setSessionCookie(login.token, login.expiresAt);
  return { user: login.user };
});

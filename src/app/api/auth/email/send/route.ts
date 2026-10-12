import { api, ApiError } from '@/server/http';
import { env } from '@/server/env';
import { sendEmailOtp } from '@/server/auth/email-otp';
import { sendEmailOtpSchema } from '@/server/schemas';

export const POST = api({ body: sendEmailOtpSchema }, async ({ body, ipKey }) => {
  if (env().LOGIN_METHOD !== 'email') throw new ApiError(404, 'not_found', 'Not found.');
  return sendEmailOtp({ ...body, ipKey });
});

import { api, ApiError } from '@/server/http';
import { env } from '@/server/env';
import { sendOtp } from '@/server/auth/otp';
import { sendOtpSchema } from '@/server/schemas';

export const POST = api({ body: sendOtpSchema }, async ({ body, ipKey }) => {
  if (env().LOGIN_METHOD !== 'phone') throw new ApiError(404, 'not_found', 'Not found.');
  return sendOtp({ ...body, ipKey });
});

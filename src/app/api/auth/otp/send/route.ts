import { api } from '@/server/http';
import { sendOtp } from '@/server/auth/otp';
import { sendOtpSchema } from '@/server/schemas';

export const POST = api({ body: sendOtpSchema }, async ({ body, ipKey }) => sendOtp({ ...body, ipKey }));

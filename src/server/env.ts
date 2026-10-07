import 'server-only';
import { z } from 'zod';

/**
 * Environment, validated once. Fails fast with a readable message instead of
 * misbehaving later. Production refuses the development-only providers.
 */
const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1')
  .optional()
  .default(false);

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),

    /** The public origin, e.g. https://ammalabs.in. Used for CSRF origin checks and absolute links. */
    APP_URL: z.url(),
    /** At least 32 random characters. Signs OTP hashes. Rotating it invalidates pending OTPs only. */
    APP_SECRET: z.string().min(32, 'APP_SECRET must be at least 32 characters'),
    /** Honour X-Forwarded-For. Only set behind a proxy you trust (Vercel, a load balancer). */
    TRUST_PROXY: bool,
    /** Lets `next start` use dev providers on a laptop. Never set in real production. */
    ALLOW_DEV_PROVIDERS: bool,

    SMS_PROVIDER: z.enum(['dev', 'msg91']).default('dev'),
    MSG91_AUTH_KEY: z.string().optional(),
    /** DLT-registered OTP template id in MSG91. */
    MSG91_OTP_TEMPLATE_ID: z.string().optional(),

    PAYMENT_PROVIDER: z.enum(['mock', 'razorpay']).default('mock'),
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    LOCAL_STORAGE_DIR: z.string().default('.storage'),
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().default('ap-south-1'),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: bool,

    WHATSAPP_PROVIDER: z.enum(['off', 'cloud']).default('off'),
    WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
    WHATSAPP_TOKEN: z.string().optional(),

    /** Shared secret for the scheduled jobs under /api/cron. */
    CRON_SECRET: z.string().min(24).optional(),
  })
  .superRefine((e, ctx) => {
    const need = (cond: boolean, path: string, message: string) => cond || ctx.addIssue({ code: 'custom', path: [path], message });
    const prod = e.NODE_ENV === 'production' && !e.ALLOW_DEV_PROVIDERS;
    if (prod) {
      need(e.SMS_PROVIDER !== 'dev', 'SMS_PROVIDER', 'the dev SMS provider would show OTPs on screen; not allowed in production');
      need(e.PAYMENT_PROVIDER !== 'mock', 'PAYMENT_PROVIDER', 'the mock payment provider is not allowed in production');
      need(e.STORAGE_DRIVER !== 'local', 'STORAGE_DRIVER', 'local disk storage is lost between deployments; use s3 in production');
      need(e.APP_URL.startsWith('https://'), 'APP_URL', 'must be https in production');
      need(e.CRON_SECRET !== undefined, 'CRON_SECRET', 'required in production for scheduled jobs');
    }
    if (e.SMS_PROVIDER === 'msg91') {
      need(!!e.MSG91_AUTH_KEY, 'MSG91_AUTH_KEY', 'required when SMS_PROVIDER=msg91');
      need(!!e.MSG91_OTP_TEMPLATE_ID, 'MSG91_OTP_TEMPLATE_ID', 'required when SMS_PROVIDER=msg91');
    }
    if (e.PAYMENT_PROVIDER === 'razorpay') {
      need(!!e.RAZORPAY_KEY_ID, 'RAZORPAY_KEY_ID', 'required when PAYMENT_PROVIDER=razorpay');
      need(!!e.RAZORPAY_KEY_SECRET, 'RAZORPAY_KEY_SECRET', 'required when PAYMENT_PROVIDER=razorpay');
      need(!!e.RAZORPAY_WEBHOOK_SECRET, 'RAZORPAY_WEBHOOK_SECRET', 'required when PAYMENT_PROVIDER=razorpay');
    }
    if (e.STORAGE_DRIVER === 's3') {
      need(!!e.S3_BUCKET, 'S3_BUCKET', 'required when STORAGE_DRIVER=s3');
      need(!!e.S3_ACCESS_KEY_ID, 'S3_ACCESS_KEY_ID', 'required when STORAGE_DRIVER=s3');
      need(!!e.S3_SECRET_ACCESS_KEY, 'S3_SECRET_ACCESS_KEY', 'required when STORAGE_DRIVER=s3');
    }
    if (e.WHATSAPP_PROVIDER === 'cloud') {
      need(!!e.WHATSAPP_PHONE_NUMBER_ID, 'WHATSAPP_PHONE_NUMBER_ID', 'required when WHATSAPP_PROVIDER=cloud');
      need(!!e.WHATSAPP_TOKEN, 'WHATSAPP_TOKEN', 'required when WHATSAPP_PROVIDER=cloud');
    }
  });

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.') || '(env)'}: ${i.message}`);
    throw new Error(`Invalid environment:\n${lines.join('\n')}`);
  }
  cached = parsed.data;
  return cached;
}

/** For tests that change process.env between cases. */
export function resetEnvCache() {
  cached = undefined;
}

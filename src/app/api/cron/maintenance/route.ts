import { timingSafeEqual } from 'node:crypto';
import { api, ApiError } from '@/server/http';
import { env } from '@/server/env';
import { expireStaleOrders } from '@/server/payments/service';
import { retryNotifications } from '@/server/notify';
import { purgeExpiredAuth } from '@/server/auth/session';
import { purgeRateLimits } from '@/server/rate-limit';

/**
 * Scheduled housekeeping (see vercel.json): release unpaid slot holds, retry messages that
 * failed, and delete expired sessions, codes and rate-limit counters.
 * Called with `Authorization: Bearer $CRON_SECRET`.
 */
export const GET = api({ skipCsrf: true }, async ({ req }) => {
  const secret = env().CRON_SECRET;
  if (!secret) throw new ApiError(503, 'not_configured', 'Cron is not configured.');
  const given = Buffer.from(req.headers.get('authorization') ?? '');
  const want = Buffer.from(`Bearer ${secret}`);
  if (given.length !== want.length || !timingSafeEqual(given, want)) throw new ApiError(401, 'unauthenticated', 'Unauthorised.');
  const [expiredOrders, retried, auth, limits] = await Promise.all([expireStaleOrders(), retryNotifications(), purgeExpiredAuth(), purgeRateLimits()]);
  return { expiredOrders, retriedNotifications: retried, purged: { ...auth, rateLimits: limits } };
});

import 'server-only';
import { db } from './db';
import { hmac } from './crypto';

export interface RateResult {
  ok: boolean;
  count: number;
  /** Seconds until the window resets. */
  retryAfter: number;
}

/**
 * Fixed-window counter in Postgres, one atomic statement per hit. Postgres (not process
 * memory) so the limit holds across serverless instances. Keys are hashed so raw phone
 * numbers and IPs aren't stored here.
 */
export async function hit(scope: string, subject: string, limit: number, windowSec: number): Promise<RateResult> {
  const key = `${scope}:${hmac('rl', subject).slice(0, 32)}`;
  const rows = await db.$queryRaw<{ count: number; secs: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart") VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" < now() - (${windowSec}::int * interval '1 second') THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" < now() - (${windowSec}::int * interval '1 second') THEN now() ELSE "RateLimit"."windowStart" END
    RETURNING "count", CEIL(EXTRACT(EPOCH FROM ("windowStart" + (${windowSec}::int * interval '1 second') - now())))::int AS "secs"`;
  const row = rows[0]!;
  return { ok: row.count <= limit, count: row.count, retryAfter: Math.max(1, row.secs) };
}

/** Housekeeping: drop counters whose window ended long ago. Called by the cron job. */
export async function purgeRateLimits(olderThanSec = 86_400): Promise<number> {
  return db.$executeRaw`DELETE FROM "RateLimit" WHERE "windowStart" < now() - (${olderThanSec}::int * interval '1 second')`;
}

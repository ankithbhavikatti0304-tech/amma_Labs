import 'server-only';
import { db } from './db';
import { hit } from './rate-limit';
import { ApiError } from './http-errors';

/**
 * "Call me back". Public, so it is limited per number and per network, and a number that
 * already has an open request in the last 30 minutes doesn't create a duplicate.
 */
export async function requestCallback(input: { phone: string; name?: string; userId?: string; ipKey: string }): Promise<void> {
  const [byIp, byPhone] = await Promise.all([hit('cb-ip', input.ipKey, 10, 3600), hit('cb-phone', input.phone, 3, 86_400)]);
  if (!byIp.ok || !byPhone.ok) throw new ApiError(429, 'rate_limited', "We already have your request. We'll call you soon.");
  const recent = await db.callbackRequest.findFirst({ where: { phone: input.phone, status: 'NEW', createdAt: { gt: new Date(Date.now() - 30 * 60_000) } }, select: { id: true } });
  if (recent) return;
  await db.callbackRequest.create({ data: { phone: input.phone, name: input.name ?? null, userId: input.userId ?? null } });
}

import 'server-only';
import { db } from '../db';
import { randomToken, sha256 } from '../crypto';
import { SESSION } from '@/config/lab';
import type { Role } from '@/generated/prisma/enums';

export interface SessionUser {
  id: string;
  name: string;
  phone: string;
  role: Role;
}

export interface SessionInfo {
  sessionId: string;
  user: SessionUser;
}

export const isStaff = (role: Role): boolean => role !== 'PATIENT';

const H = 3600_000;
const D = 24 * H;

/** Create a session. The caller puts `token` in an httpOnly cookie; only its hash is stored. */
export async function createSession(userId: string, role: Role, userAgent?: string | null): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken();
  const maxMs = isStaff(role) ? SESSION.staffMaxHours * H : SESSION.patientMaxDays * D;
  const expiresAt = new Date(Date.now() + maxMs);
  await db.session.create({ data: { tokenHash: sha256(token), userId, expiresAt, userAgent: userAgent?.slice(0, 200) ?? null } });
  return { token, expiresAt };
}

/**
 * Resolve a cookie token to a live session, or null. Enforces absolute expiry, idle timeout
 * (shorter for staff), revocation and account status. Role is read fresh from the user row,
 * so demoting someone takes effect on their next request.
 */
export async function findSession(token: string): Promise<SessionInfo | null> {
  const s = await db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!s || s.revokedAt || !s.user.active) return null;
  const now = Date.now();
  if (s.expiresAt.getTime() <= now) return null;
  const staff = isStaff(s.user.role);
  if (staff && now - s.createdAt.getTime() > SESSION.staffMaxHours * H) return null;
  const idleMs = staff ? SESSION.staffIdleHours * H : SESSION.patientIdleDays * D;
  if (now - s.lastSeenAt.getTime() > idleMs) return null;
  // Sliding idle window, written at most every 5 minutes to keep reads cheap.
  if (now - s.lastSeenAt.getTime() > 5 * 60_000) {
    await db.session.update({ where: { id: s.id }, data: { lastSeenAt: new Date(now) } }).catch(() => undefined);
  }
  return { sessionId: s.id, user: { id: s.user.id, name: s.user.name, phone: s.user.phone, role: s.user.role } };
}

export async function revokeSession(sessionId: string): Promise<void> {
  await db.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await db.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

/** Housekeeping for the cron job. */
export async function purgeExpiredAuth(): Promise<{ sessions: number; otps: number }> {
  const cutoff = new Date(Date.now() - 7 * D);
  const [sessions, otps] = await Promise.all([
    db.session.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: cutoff } }] } }),
    db.otpRequest.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 1 * D) } } }),
  ]);
  return { sessions: sessions.count, otps: otps.count };
}

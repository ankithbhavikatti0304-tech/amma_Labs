import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION } from '@/config/lab';
import { env } from '../env';
import { ApiError } from '../http-errors';
import { findSession, type SessionInfo, type SessionUser } from './session';
import type { Role } from '@/generated/prisma/enums';

const secure = () => env().APP_URL.startsWith('https://');
/** The __Host- prefix makes browsers refuse the cookie unless it is Secure, Path=/ and has no Domain. */
export const sessionCookieName = () => (secure() ? `__Host-${SESSION.cookie}` : SESSION.cookie);

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(sessionCookieName(), token, { httpOnly: true, secure: secure(), sameSite: 'lax', path: '/', expires: expiresAt });
}

export async function clearSessionCookie() {
  (await cookies()).set(sessionCookieName(), '', { httpOnly: true, secure: secure(), sameSite: 'lax', path: '/', maxAge: 0 });
}

/** The current session, looked up once per request. */
export const getSession = cache(async (): Promise<SessionInfo | null> => {
  const token = (await cookies()).get(sessionCookieName())?.value;
  return token ? findSession(token) : null;
});

export const getUser = async (): Promise<SessionUser | null> => (await getSession())?.user ?? null;

/** For API handlers: 401 if not logged in, 403 if the role is wrong. */
export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getUser();
  if (!user) throw new ApiError(401, 'unauthenticated', 'Please log in to continue.');
  if (roles && !roles.includes(user.role) && user.role !== 'ADMIN') throw new ApiError(403, 'forbidden', "You don't have access to this.");
  return user;
}

/** For pages: send logged-out visitors to /login and back; show not-found-style redirect for wrong role. */
export async function requirePageUser(next: string, roles?: Role[]): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (roles && !roles.includes(user.role) && user.role !== 'ADMIN') redirect('/');
  return user;
}

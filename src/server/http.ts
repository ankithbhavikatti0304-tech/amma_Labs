import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { env } from './env';
import { hmac } from './crypto';
import { ApiError } from './http-errors';
import { hit } from './rate-limit';
import { log } from './log';
import { requireUser } from './auth/cookie';
import type { SessionUser } from './auth/session';
import type { Role } from '@/generated/prisma/enums';

export { ApiError };

const MAX_BODY = 100_000;
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Client address, only if we sit behind a proxy we trust. Hashed before it is used as a key. */
export function clientIpKey(req: Request): string {
  if (!env().TRUST_PROXY) return 'direct';
  const xff = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return xff || req.headers.get('x-real-ip') || 'unknown';
}

/**
 * CSRF defence in depth on top of SameSite=Lax cookies. Browsers always send Origin on
 * cross-origin and on same-origin POST/PUT/PATCH/DELETE, so: if Origin is present it must be
 * ours; if absent, Sec-Fetch-Site must say same-origin/none; if neither is present, refuse.
 */
export function assertSameOrigin(req: Request): void {
  const e = env();
  const allowed = new Set([new URL(e.APP_URL).origin]);
  if (e.NODE_ENV !== 'production') {
    const host = req.headers.get('host');
    if (host) allowed.add(`http://${host}`);
  }
  const origin = req.headers.get('origin');
  if (origin) {
    if (!allowed.has(origin)) throw new ApiError(403, 'bad_origin', 'Request blocked.');
    return;
  }
  const site = req.headers.get('sec-fetch-site');
  if (site === 'same-origin' || site === 'none') return;
  throw new ApiError(403, 'bad_origin', 'Request blocked.');
}

export interface Ctx<B, Q, P> {
  req: NextRequest;
  body: B;
  query: Q;
  params: P;
  /** null unless `auth` was set. */
  user: SessionUser;
  ipKey: string;
}

export interface ApiOptions<B extends z.ZodType | undefined, Q extends z.ZodType | undefined> {
  /** 'user' = any logged-in user; a role list = those roles (admin always allowed). Omit for public. */
  auth?: 'user' | Role[];
  body?: B;
  query?: Q;
  /** Per-user (or per-IP when logged out) limit for this endpoint. */
  limit?: { name: string; max: number; windowSec: number };
  /** Webhooks and cron authenticate by signature/secret, not cookies, so skip the origin check. */
  skipCsrf?: boolean;
}

type Infer<T> = T extends z.ZodType ? z.infer<T> : undefined;

/**
 * Wrap a route handler: origin check, auth, rate limit, input validation, error mapping.
 * Handlers return a plain object (sent as JSON 200) or a Response.
 */
export function api<B extends z.ZodType | undefined = undefined, Q extends z.ZodType | undefined = undefined, P = Record<string, string>>(
  opts: ApiOptions<B, Q>,
  handler: (ctx: Ctx<Infer<B>, Infer<Q>, P>) => Promise<Response | object | null>,
) {
  return async (req: NextRequest, route?: { params: Promise<P> }): Promise<Response> => {
    const requestId = crypto.randomUUID().slice(0, 8);
    try {
      if (MUTATING.has(req.method) && !opts.skipCsrf) assertSameOrigin(req);

      const user = opts.auth ? await requireUser(opts.auth === 'user' ? undefined : opts.auth) : (null as unknown as SessionUser);
      const ipKey = clientIpKey(req);

      if (opts.limit) {
        const r = await hit(`api-${opts.limit.name}`, user?.id ?? ipKey, opts.limit.max, opts.limit.windowSec);
        if (!r.ok) throw new ApiError(429, 'rate_limited', 'Too many requests. Please slow down.', { retryAfter: r.retryAfter });
      }

      let body: unknown;
      if (opts.body) {
        const text = await req.text();
        if (text.length > MAX_BODY) throw new ApiError(413, 'too_large', 'Request is too large.');
        let raw: unknown;
        try {
          raw = text ? JSON.parse(text) : {};
        } catch {
          throw new ApiError(400, 'bad_json', 'Request body is not valid JSON.');
        }
        const parsed = opts.body.safeParse(raw);
        if (!parsed.success) throw validationError(parsed.error);
        body = parsed.data;
      }

      let query: unknown;
      if (opts.query) {
        const parsed = opts.query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
        if (!parsed.success) throw validationError(parsed.error);
        query = parsed.data;
      }

      const params = (route?.params ? await route.params : {}) as P;
      const out = await handler({ req, body: body as Infer<B>, query: query as Infer<Q>, params, user, ipKey });
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (err) {
      return errorResponse(err, requestId);
    }
  };
}

function validationError(err: z.ZodError): ApiError {
  const fields: Record<string, string> = {};
  for (const i of err.issues) fields[i.path.join('.') || '_'] ??= i.message;
  return new ApiError(400, 'invalid_input', 'Please check the highlighted fields.', { fields });
}

export function errorResponse(err: unknown, requestId?: string): Response {
  if (err instanceof z.ZodError) return errorResponse(validationError(err), requestId);
  if (err instanceof ApiError) {
    const headers: Record<string, string> = {};
    const retry = err.extra?.retryAfter;
    if (typeof retry === 'number') headers['Retry-After'] = String(retry);
    return NextResponse.json({ error: { code: err.code, message: err.message, ...err.extra } }, { status: err.status, headers });
  }
  // Unknown failure: log it with an id, tell the person nothing about internals.
  log.error('unhandled api error', { requestId, err });
  return NextResponse.json({ error: { code: 'server_error', message: 'Something went wrong on our side. Please try again.', requestId } }, { status: 500 });
}

/** A stable per-install id for keys that must not be guessable, kept here so callers don't import hmac directly. */
export const opaqueKey = (purpose: string, v: string) => hmac(purpose, v);

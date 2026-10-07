import { NextResponse, type NextRequest } from 'next/server';

/**
 * Runs before every page request:
 *  1. Sets a Content-Security-Policy with a fresh nonce, so only our own scripts run.
 *  2. Sends visitors without a session cookie away from /staff and /admin. This is only a
 *     fast pre-check; every staff page and API re-checks the real session and role.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (/^\/(staff|admin)(\/|$)/.test(pathname)) {
    const has = request.cookies.has('__Host-al_session') || request.cookies.has('al_session');
    if (!has) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(pathname)}`, request.url));
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const dev = process.env.NODE_ENV === 'development';
  const razorpay = process.env.PAYMENT_PROVIDER === 'razorpay';

  const csp = [
    "default-src 'self'",
    // 'strict-dynamic' lets our nonce'd scripts load their own chunks (and Razorpay's checkout.js), and ignores any injected script without the nonce.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    // Style *attributes* (React style props, used for animation delays and range bars) cannot run code, so they are allowed; <style> elements need the nonce.
    `style-src 'self' ${dev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${razorpay ? ' https://api.razorpay.com https://lumberjack.razorpay.com' : ''}`,
    `frame-src 'self'${razorpay ? ' https://api.razorpay.com https://checkout.razorpay.com' : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');

  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set('Content-Security-Policy', csp);
  return res;
}

export const config = {
  matcher: [
    {
      // Not API routes, build assets or the icon; and skip link prefetches.
      source: '/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};

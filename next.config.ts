import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';

// Static security headers. The Content-Security-Policy (which needs a per-request nonce)
// is set in src/proxy.ts.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  ...(isProd ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }] : []),
];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The report PDF reads its embedded Manrope fonts from disk at runtime; file tracing cannot see that, so ship them
  // with the two routes that render PDFs. (Route keys are globs, hence the escaped brackets.)
  outputFileTracingIncludes: {
    '/api/staff/orders/\\[code\\]/release': ['./src/server/pdf/fonts/**/*'],
    '/api/orders/\\[code\\]/report': ['./src/server/pdf/fonts/**/*'],
  },
  serverExternalPackages: ['pdfkit', 'pg', '@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner'],
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Anything under /api carries personal data or session state: never cache it in a shared cache.
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ];
  },
};

export default config;

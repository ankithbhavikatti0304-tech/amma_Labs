import type { MetadataRoute } from 'next';
import { env } from '@/server/env';

// Rendered per request so the build needs no runtime configuration.
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/admin', '/staff', '/cart', '/checkout', '/orders', '/account', '/login', '/search'] }],
    sitemap: `${env().APP_URL}/sitemap.xml`,
  };
}

import type { MetadataRoute } from 'next';
import { env } from '@/server/env';
import { getCatalogue } from '@/server/catalogue';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env().APP_URL;
  const { tests, categories } = await getCatalogue();
  return [
    { url: base, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/tests`, changeFrequency: 'weekly', priority: 0.9 },
    ...categories.map((c) => ({ url: `${base}/category/${c.id}`, changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...tests.map((t) => ({ url: `${base}/test/${t.slug}`, changeFrequency: 'weekly' as const, priority: 0.7 })),
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
  ];
}

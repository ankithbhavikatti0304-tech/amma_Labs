import type { Metadata } from 'next';
import { Listing } from '@/components/catalogue/Listing';
import { filtersFromParams } from '@/lib/filters-url';

export const metadata: Metadata = { title: 'Search', robots: { index: false } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const raw = sp.q;
  const q = ((Array.isArray(raw) ? raw[0] : raw) ?? '').slice(0, 80);
  return <Listing categoryId={null} query={q} title={`Results for “${q}”`} crumb="Search" initial={filtersFromParams(sp)} />;
}

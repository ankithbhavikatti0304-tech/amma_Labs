import type { Metadata } from 'next';
import { Listing } from '@/components/catalogue/Listing';
import { filtersFromParams } from '@/lib/filters-url';

export const metadata: Metadata = { title: 'All tests', description: 'Every blood test and health package at Amma Labs, with prices and report times.' };

export default async function AllTests({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Listing categoryId="all" title="All tests" crumb="All tests" initial={filtersFromParams(await searchParams)} />;
}

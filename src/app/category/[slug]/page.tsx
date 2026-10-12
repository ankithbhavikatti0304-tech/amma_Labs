import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Listing } from '@/components/catalogue/Listing';
import { filtersFromParams } from '@/lib/filters-url';
import { getCatalogue } from '@/server/catalogue';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = (await getCatalogue()).categories.find((x) => x.id === slug);
  return c ? { title: c.name, description: `${c.name} tests and packages with home sample collection from Amma Labs.` } : {};
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const c = (await getCatalogue()).categories.find((x) => x.id === slug);
  if (!c) notFound();
  return <Listing categoryId={c.id} title={c.name} crumb={c.name} initial={filtersFromParams(await searchParams)} />;
}

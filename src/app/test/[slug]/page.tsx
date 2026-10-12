import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCatalogue } from '@/server/catalogue';
import { TestArt } from '@/components/character/Character';
import { AddButton } from '@/components/AddButton';
import { ProductCard } from '@/components/catalogue/ProductCard';
import { discountPercent } from '@/lib/pricing';
import { inr } from '@/lib/money';
import { tatRange } from '@/lib/catalogue';

type Props = { params: Promise<{ slug: string }> };

async function find(slug: string) {
  const data = await getCatalogue();
  return { data, test: data.tests.find((t) => t.slug === slug) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { test } = await find((await params).slug);
  if (!test) return {};
  return {
    title: test.name,
    description: `${test.name}: ${inr(test.price)}, report in ${tatRange(test)} hours${test.centreVisit ? ', done at the centre' : ', with free home sample collection above the minimum order'}. Book online with Amma Labs.`,
    alternates: { canonical: `/test/${test.slug}` },
  };
}

export default async function TestPage({ params }: Props) {
  const { data, test: t } = await find((await params).slug);
  if (!t) notFound();
  const d = discountPercent(t);
  const cat = data.categories.find((c) => c.id === t.categories[0]);
  const related = data.tests.filter((x) => x.id !== t.id && x.categories.some((c) => t.categories.includes(c)) && x.isPackage === t.isPackage).slice(0, 3);
  // Structured data for search engines. JSON is escaped so it can't close the script tag.
  const ld = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'MedicalTest',
    name: t.name,
    offers: { '@type': 'Offer', price: t.price, priceCurrency: 'INR', availability: 'https://schema.org/InStock' },
    provider: { '@type': 'MedicalBusiness', name: 'Amma Labs' },
  }).replace(/</g, '\\u003c');

  return (
    <div className="wrap">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} />
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span>/</span>
        {cat ? <><Link href={`/category/${cat.id}`}>{cat.name}</Link><span>/</span></> : null}
        <span>{t.name}</span>
      </nav>
      <div className="two">
        <div className="stack">
          <div className="panel">
            <div className="detail-top" style={{ marginBottom: 16 }}>
              <TestArt t={t} size="lg" />
              <div>
                <h1 style={{ fontSize: 'clamp(24px,3.4vw,36px)' }}>{t.name}</h1>
                <p className="muted" style={{ marginTop: 6, fontWeight: 600 }}>{t.isPackage ? 'Health checkup package' : t.centreVisit ? 'Done at the centre' : 'Single test'}</p>
              </div>
            </div>
            <div className="facts">
              <div><span>Report</span>{tatRange(t)} hrs</div>
              <div><span>Sample</span>{t.centreVisit ? 'At centre' : 'Blood'}</div>
              <div><span>Preparation</span>{t.fasting ? '10–12 hr fasting' : t.morningSample ? 'Before 9 am' : 'None'}</div>
            </div>
            {t.includes.length ? (
              <>
                <h2 style={{ fontSize: 18, margin: '8px 0 10px' }}>Includes {t.parameterCount ? `${t.parameterCount} tests` : ''}</h2>
                <ul className="detail-list">{t.includes.map((x) => <li key={x}>{x}</li>)}</ul>
              </>
            ) : null}
          </div>
        </div>
        <div className="stack">
          <div className="panel sticky">
            <div className="prices" style={{ marginBottom: 14 }}>
              <span className="price">{inr(t.price)}</span>{d ? <><s>{inr(t.mrp)}</s><span className="off">{d}% off</span></> : null}
            </div>
            <AddButton id={t.id} name={t.name} className="block" />
            <p className="muted" style={{ fontSize: 13, margin: '12px 0 0' }}>Free home collection above {inr(data.settings.freeCollectionAbove)}. Pay at collection or online.</p>
          </div>
        </div>
      </div>
      {related.length ? (
        <section className="sec">
          <div className="sec-head"><h2>You may also need</h2></div>
          <div className="grid">{related.map((r) => <ProductCard key={r.id} t={r} />)}</div>
        </section>
      ) : null}
    </div>
  );
}

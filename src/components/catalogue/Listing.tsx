'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/components/providers';
import { applyFilters, findTests, inCategory, type Filters } from '@/lib/catalogue';
import { ProductCard } from './ProductCard';
import { Character } from '@/components/character/Character';
import { Icon } from '@/components/Icon';

export function CategoryArt({ c, size }: { c: { id: string; tint: string; mascot: string; mascotArg: string | null }; size?: 'xs' | 'md' }) {
  return <Character id={`c${c.id}`} mascot={c.mascot} arg={c.mascotArg} tint={c.tint} size={size} />;
}

/**
 * Category, all-tests and search results. Filters and sorting run in the browser over the
 * catalogue it already has, so they apply instantly; the URL is updated in place so the
 * view can be shared and survives a refresh.
 */
export function Listing({ categoryId, query, title, crumb, initial }: { categoryId: string | null; query?: string; title: string; crumb: string; initial: Filters }) {
  const { tests, categories, city } = useApp();
  const [f, setF] = useState<Filters>(initial);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const set = (k: string, on: boolean) => (on ? p.set(k, '1') : p.delete(k));
    set('pkg', f.pkg); set('fast', f.fast24); set('nofast', f.nofast);
    if (f.sort === 'pop') p.delete('sort'); else p.set('sort', f.sort);
    const qs = p.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  }, [f]);

  const list = useMemo(() => {
    const base = query !== undefined ? findTests(tests, categories, query) : inCategory(tests, categoryId ?? 'all');
    return applyFilters(base, f);
  }, [tests, categories, categoryId, query, f]);

  const toggle = (k: 'pkg' | 'fast24' | 'nofast') => setF((s) => ({ ...s, [k]: !s[k] }));

  return (
    <div className="wrap">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><span>{crumb}</span></nav>
      <div className="lhead"><div><h1>{title}</h1><p>{list.length} option{list.length === 1 ? '' : 's'} in {city} · home collection available</p></div></div>
      <div className="catrow">
        <Link href="/tests" aria-current={categoryId === 'all'}><span className="art xs t-a" style={{ display: 'grid', placeItems: 'center' }}><Icon name="spark" size={18} /></span>All tests</Link>
        {categories.map((c) => <Link key={c.id} href={`/category/${c.id}`} aria-current={categoryId === c.id}><CategoryArt c={c} size="xs" />{c.name}</Link>)}
      </div>
      <div className="toolbar">
        <div className="bar">
          <button type="button" className="chip" aria-pressed={f.pkg} onClick={() => toggle('pkg')}>Packages only</button>
          <button type="button" className="chip" aria-pressed={f.fast24} onClick={() => toggle('fast24')}><Icon name="bolt" size={14} /> Report in 24 hrs</button>
          <button type="button" className="chip" aria-pressed={f.nofast} onClick={() => toggle('nofast')}>No fasting</button>
        </div>
        <label className="chip">
          <span className="sr">Sort by</span>
          <select value={f.sort} onChange={(e) => setF((s) => ({ ...s, sort: e.target.value as Filters['sort'] }))}>
            <option value="pop">Sort: Popular</option>
            <option value="lo">Price: low to high</option>
            <option value="hi">Price: high to low</option>
            <option value="tat">Fastest report</option>
          </select>
        </label>
      </div>
      {list.length ? (
        <div className="grid">{list.map((t) => <ProductCard key={t.id} t={t} />)}</div>
      ) : (
        <div className="empty"><b>{query !== undefined && !findTests(tests, categories, query).length ? `No tests found for “${query}”.` : 'No tests match these filters.'}</b><span>{query !== undefined ? 'Try a different word, like “thyroid”, “vitamin” or “liver”.' : 'Turn a filter off to see more.'}</span></div>
      )}
    </div>
  );
}

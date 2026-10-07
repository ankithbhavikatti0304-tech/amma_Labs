'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from './Modal';
import { closePalette, openPalette, openSheet, usePaletteOpen } from '@/lib/client/ui';
import { useApp } from '@/components/providers';
import { findTests, tatRange, type TestDTO } from '@/lib/catalogue';
import { TestArt } from '@/components/character/Character';
import { AddButton } from '@/components/AddButton';
import { Icon } from '@/components/Icon';
import { inr } from '@/lib/money';

const POPULAR_SEARCHES = ['Thyroid', 'Vitamin D', 'Full body', 'HbA1c', 'Liver', 'Allergy', 'Fever'];

/** Search as you type, over the catalogue already in the browser. Opens with / or Ctrl/Cmd+K. */
export function SearchPalette() {
  const open = usePaletteOpen();
  const router = useRouter();
  const { tests, categories } = useApp();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(-1);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && /INPUT|TEXTAREA|SELECT/.test(t.tagName);
      if ((e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        openPalette();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { if (open) { setQ(''); setSel(-1); } }, [open]);

  const all = useMemo(() => findTests(tests, categories, q), [tests, categories, q]);
  const popular = useMemo(() => tests.filter((t) => t.popular).slice(0, 5), [tests]);
  const rows: TestDTO[] = q.trim() ? all.slice(0, 7) : popular;

  const seeAll = () => { const v = q.trim(); closePalette(); router.push(`/search?q=${encodeURIComponent(v)}`); };
  const openDetail = (t: TestDTO) => { closePalette(); openSheet({ kind: 'detail', id: t.id }); };

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, rows.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, -1)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const r = rows[sel];
      if (sel > -1 && r) openDetail(r);
      else if (q.trim()) seeAll();
    }
  }

  return (
    <Modal open={open} onClose={closePalette} label="Search tests" variant="palette">
      <div className="pal-in">
        <Icon name="search" size={22} />
        <label htmlFor="q" className="sr">Search tests</label>
        <input ref={input} id="q" type="search" placeholder="Search tests, packages or categories" autoComplete="off" value={q} onChange={(e) => { setQ(e.target.value); setSel(-1); }} onKeyDown={onKeyDown} role="combobox" aria-expanded="true" aria-controls="palList" aria-activedescendant={sel > -1 ? `pal-${sel}` : undefined} />
        <kbd>Esc</kbd>
      </div>
      <div className="pal-body" id="palList">
        {!q.trim() ? (
          <>
            <div className="pal-label">Popular searches</div>
            <div className="pal-chips">{POPULAR_SEARCHES.map((s) => <button key={s} type="button" className="chip" onClick={() => { setQ(s); setSel(-1); input.current?.focus(); }}>{s}</button>)}</div>
            <div className="pal-label">Most booked</div>
          </>
        ) : all.length ? <div className="pal-label">{all.length} result{all.length === 1 ? '' : 's'}</div> : null}
        {rows.map((t, i) => (
          <div key={t.id} id={`pal-${i}`} className={`pal-row${i === sel ? ' sel' : ''}`} role="option" aria-selected={i === sel}>
            <TestArt t={t} size="xs" />
            <button type="button" className="nm" onClick={() => openDetail(t)}>{t.name}<span>{inr(t.price)} · report in {tatRange(t)} hrs</span></button>
            <AddButton id={t.id} name={t.name} />
          </div>
        ))}
        {q.trim() && all.length ? <div className="pal-row"><button type="button" className="nm link" onClick={seeAll}>See all results for “{q.trim()}” →</button></div> : null}
        {q.trim() && !all.length ? <div className="pal-empty">No tests found for “{q.trim()}”. Try “thyroid”, “vitamin” or “liver”.</div> : null}
      </div>
    </Modal>
  );
}

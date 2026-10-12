'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { ProductCard } from '@/components/catalogue/ProductCard';
import { openPalette, openSheet } from '@/lib/client/ui';
import { useApp, useCartDetail } from '@/components/providers';
import { packageSegment, SEGMENTS, type Segment } from '@/lib/catalogue';
import { waCartText, waLink } from '@/lib/whatsapp';

const WORDS = ['thyroid profile', 'vitamin D', 'full body checkup', 'HbA1c', 'liver function test', 'allergy panel'];

/** The big search pill, with the typing animation (static under reduced motion). */
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const onReducedMotion = (cb: () => void) => {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};

export function HeroSearch() {
  const [text, setText] = useState(WORDS[0]!);
  // On the server, assume reduced motion (static text); the browser answers after hydration.
  const reduced = useSyncExternalStore(onReducedMotion, reducedMotion, () => true);
  const animating = !reduced;
  useEffect(() => {
    if (reduced) return;
    let w = 0, c = 0, del = false, timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const word = WORDS[w]!;
      c += del ? -1 : 1;
      setText(word.slice(0, c));
      let wait = del ? 35 : 70;
      if (!del && c === word.length) { del = true; wait = 1500; }
      else if (del && c === 0) { del = false; w = (w + 1) % WORDS.length; wait = 300; }
      timer = setTimeout(tick, wait);
    };
    timer = setTimeout(tick, 900);
    return () => clearTimeout(timer);
  }, [reduced]);
  return (
    <button type="button" className="hsearch" onClick={openPalette} aria-label="Search tests">
      <Icon name="search" size={22} />
      <span className="tx">Search for <b>{text}</b>{animating ? <span className="caret" /> : null}</span>
      <span className="go"><Icon name="arrow" size={20} /></span>
    </button>
  );
}

export function WhatsAppLink({ className, children, icon = 18 }: { className: string; children: React.ReactNode; icon?: number }) {
  const { settings, city } = useApp();
  const { items, bill } = useCartDetail();
  return (
    <a className={className} href={waLink(settings.whatsapp, waCartText(city, items, bill.total))} target="_blank" rel="noopener noreferrer">
      {className.includes('chan') ? <span className="ic"><Icon name="wa" size={icon} /></span> : <Icon name="wa" size={icon} />}{children}
    </a>
  );
}

export function CallButton({ className, children }: { className: string; children: React.ReactNode }) {
  return <button type="button" className={className} onClick={() => openSheet({ kind: 'call' })}>{children}</button>;
}

export function UploadButton({ className, children }: { className: string; children: React.ReactNode }) {
  const { user } = useApp();
  return <button type="button" className={className} onClick={() => openSheet(user ? { kind: 'upload' } : { kind: 'login', afterLogin: 'upload' })}>{children}</button>;
}

export function PackageRail() {
  const { tests } = useApp();
  const [seg, setSeg] = useState<Segment>('all');
  const rail = useRef<HTMLDivElement>(null);
  const list = packageSegment(tests, seg);
  const scroll = (dir: number) => rail.current?.scrollBy({ left: dir * rail.current.clientWidth * 0.8, behavior: 'smooth' });
  return (
    <section className="wrap sec" id="pkgs">
      <div className="sec-head">
        <div><span className="eyebrow">Health checkups</span><h2>Full body packages, up to 50% off</h2></div>
        <div className="bar">
          {SEGMENTS.map(([k, l]) => (
            <button key={k} type="button" className="chip" aria-pressed={seg === k} onClick={() => { setSeg(k); if (rail.current) rail.current.scrollLeft = 0; }}>{l}</button>
          ))}
          <button type="button" className="chip" onClick={() => scroll(-1)} aria-label="Scroll back">←</button>
          <button type="button" className="chip" onClick={() => scroll(1)} aria-label="Scroll forward">→</button>
        </div>
      </div>
      <div className="rail" ref={rail}>{list.map((t) => <ProductCard key={t.id} t={t} />)}</div>
      {!list.length ? <div className="empty">No packages in this group yet.</div> : null}
    </section>
  );
}

export function SeeAll({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link className="link" href={href}>{children}</Link>;
}

'use client';
import { memo, useState } from 'react';
import Link from 'next/link';
import { TestArt } from '@/components/character/Character';
import { AddButton } from '@/components/AddButton';
import { Icon } from '@/components/Icon';
import { openSheet } from '@/lib/client/ui';
import { discountPercent } from '@/lib/pricing';
import { inr } from '@/lib/money';
import { tatRange, type TestDTO } from '@/lib/catalogue';

/** A test or package card, as in the prototype. Memoised so filtering a long list is instant. */
export const ProductCard = memo(function ProductCard({ t }: { t: TestDTO }) {
  const [open, setOpen] = useState(false);
  const d = discountPercent(t);
  const badge = t.centreVisit ? 'At centre' : t.isPackage ? 'Package' : t.popular ? 'Popular' : '';
  return (
    <article className="card">
      <div className={`media t-${t.tint}`}>
        {badge ? <span className="badge">{badge}</span> : null}
        {d ? <span className="disc">{d}% off</span> : null}
        <TestArt t={t} size="xl" />
      </div>
      <div className="cbody">
        <h3>
          {/* A real link (crawlable, opens in a new tab on cmd/ctrl-click); a plain click opens the quick-view sheet. */}
          <Link
            href={`/test/${t.slug}`}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
              e.preventDefault();
              openSheet({ kind: 'detail', id: t.id });
            }}
          >
            {t.name}
          </Link>
        </h3>
        <div className="pills">
          {t.parameterCount ? (
            <button type="button" className="pill inc" aria-expanded={open} aria-controls={`inc-${t.id}`} onClick={() => setOpen((o) => !o)}>
              {t.parameterCount} tests <Icon name="chev" size={14} />
            </button>
          ) : null}
          <span className="pill"><Icon name="clock" size={14} /> {tatRange(t)} hrs</span>
          {t.fasting ? <span className="pill warn">Fasting</span> : null}
        </div>
        {t.parameterCount ? (
          <ul className="incl" id={`inc-${t.id}`} hidden={!open}>{t.includes.map((x) => <li key={x}>{x}</li>)}</ul>
        ) : null}
        <div className="buy">
          <div className="prices"><span className="price">{inr(t.price)}</span>{d ? <s>{inr(t.mrp)}</s> : null}</div>
          <AddButton id={t.id} name={t.name} />
        </div>
      </div>
    </article>
  );
});

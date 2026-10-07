'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCartDetail } from '@/components/providers';
import { TestArt } from '@/components/character/Character';
import { Icon } from '@/components/Icon';
import { inr } from '@/lib/money';

const HIDE_ON = ['/cart', '/checkout', '/orders', '/staff', '/admin', '/login'];

/** The floating cart bar. Appears as soon as something is added. */
export function Dock() {
  const path = usePathname();
  const { items, bill } = useCartDetail();
  const n = items.length;
  const show = n > 0 && !HIDE_ON.some((p) => path === p || path.startsWith(`${p}/`));
  return (
    <div className={`dock${show ? ' show' : ''}`} aria-hidden={!show}>
      <span className="stackav">{items.slice(-3).map((t) => <TestArt key={t.id} t={t} size="xs" />)}</span>
      <div className="what">
        <b>{n} test{n === 1 ? '' : 's'} · {inr(bill.priceTotal)}</b>
        <span>{items.map((t) => t.name).join(', ')}</span>
      </div>
      <Link className="btn white" href="/cart" tabIndex={show ? 0 : -1}>View cart <Icon name="arrow" size={16} strokeWidth={2.4} /></Link>
    </div>
  );
}

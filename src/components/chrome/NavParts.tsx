'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { openPalette, openSheet, toast } from '@/lib/client/ui';
import { useCart } from '@/lib/client/cart';
import { useApp } from '@/components/providers';
import { CITIES, CITY_COOKIE } from '@/config/lab';

const LINKS = [
  { href: '/category/full', label: 'Packages' },
  { href: '/tests', label: 'All tests' },
  { href: '/#how', label: 'How it works' },
  { href: '/orders', label: 'Reports' },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="links" aria-label="Main">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} aria-current={path === l.href ? 'page' : undefined} className="navlink">{l.label}</Link>
      ))}
    </nav>
  );
}

export function CitySelect() {
  const { city } = useApp();
  const router = useRouter();
  return (
    <label className="npill city">
      <Icon name="pin" size={16} strokeWidth={2} />
      <span className="sr">City</span>
      <select
        value={city}
        onChange={(e) => {
          document.cookie = `${CITY_COOKIE}=${encodeURIComponent(e.target.value)}; path=/; max-age=31536000; samesite=lax`;
          toast(`Showing tests in ${e.target.value}`);
          router.refresh();
        }}
      >
        {CITIES.map((c) => <option key={c}>{c}</option>)}
      </select>
    </label>
  );
}

export function SearchButton() {
  return (
    <button type="button" className="npill srch" onClick={openPalette} aria-label="Search tests">
      <Icon name="search" size={18} strokeWidth={2.2} />
      <span>Search tests</span>
      <kbd>/</kbd>
    </button>
  );
}

export function UserButton() {
  const { user } = useApp();
  if (user) {
    const initials = user.name.split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase();
    return (
      <>
        {user.role !== 'PATIENT' ? <Link className="npill" href={user.role === 'ADMIN' ? '/admin' : '/staff'}>Staff</Link> : null}
        <Link className="avatar" href="/orders" aria-label="My orders and reports">{initials}</Link>
      </>
    );
  }
  return (
    <button type="button" className="npill" onClick={() => openSheet({ kind: 'login' })} aria-label="Log in">
      <Icon name="user" size={18} /><span className="lbl">Log in</span>
    </button>
  );
}

export function CartButton() {
  const { ids } = useCart();
  const n = ids.length;
  const el = useRef<HTMLSpanElement>(null);
  const prev = useRef(n);
  useEffect(() => {
    if (prev.current !== n && el.current) {
      el.current.classList.remove('bump');
      void el.current.offsetWidth;
      el.current.classList.add('bump');
    }
    prev.current = n;
  }, [n]);
  return (
    <Link className="npill dark" href="/cart" aria-label={`Cart, ${n} item${n === 1 ? '' : 's'}`}>
      <Icon name="cart" size={18} strokeWidth={2.2} /><span className="lbl">Cart</span>
      <span ref={el} className="count">{n}</span>
    </Link>
  );
}

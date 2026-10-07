'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function StaffNav({ tabs }: { tabs: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="catrow" aria-label="Staff sections" style={{ marginTop: 18 }}>
      {tabs.map((t) => {
        const on = t.href === '/staff' || t.href === '/admin' ? path === t.href : path.startsWith(t.href);
        return <Link key={t.href} href={t.href} aria-current={on} style={{ paddingLeft: 16 }}>{t.label}</Link>;
      })}
    </nav>
  );
}

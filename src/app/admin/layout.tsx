import type { Metadata } from 'next';
import { requirePageUser } from '@/server/auth/cookie';
import { StaffNav } from '@/components/staff/StaffNav';

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } };

const TABS = [
  { href: '/admin', label: 'Orders' }, { href: '/admin/tests', label: 'Tests & prices' }, { href: '/admin/ranges', label: 'Reference ranges' },
  { href: '/admin/coupons', label: 'Coupons' }, { href: '/admin/slots', label: 'Slots' }, { href: '/admin/staff', label: 'Staff' },
  { href: '/admin/inbox', label: 'Inbox' }, { href: '/admin/settings', label: 'Settings' }, { href: '/staff', label: 'Work queue' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser('/admin', ['ADMIN']);
  return (
    <div className="wrap">
      <div className="lhead" style={{ paddingTop: 28 }}><div><h1>Admin</h1><p>{user.name}</p></div></div>
      <StaffNav tabs={TABS} />
      <div style={{ marginTop: 18, paddingBottom: 24 }}>{children}</div>
    </div>
  );
}

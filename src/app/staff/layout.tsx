import type { Metadata } from 'next';
import { requirePageUser } from '@/server/auth/cookie';
import { StaffNav } from '@/components/staff/StaffNav';

export const metadata: Metadata = { title: 'Staff', robots: { index: false, follow: false } };

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser('/staff', ['PHLEBOTOMIST', 'TECHNICIAN', 'PATHOLOGIST']);
  return (
    <div className="wrap">
      <div className="lhead" style={{ paddingTop: 28 }}>
        <div><h1>Staff</h1><p>{user.name} · {user.role.toLowerCase()}</p></div>
      </div>
      <StaffNav tabs={[{ href: '/staff', label: 'Work queue' }, ...(user.role === 'ADMIN' ? [{ href: '/admin', label: 'Admin' }] : [])]} />
      <div style={{ marginTop: 18, paddingBottom: 24 }}>{children}</div>
    </div>
  );
}

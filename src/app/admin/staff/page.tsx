import { db } from '@/server/db';
import { ActionButton, AdminForm } from '@/components/admin/AdminForm';
import { formatPhone } from '@/lib/phone';
import { requirePageUser } from '@/server/auth/cookie';

const ROLES = [{ value: 'PHLEBOTOMIST', label: 'Phlebotomist' }, { value: 'TECHNICIAN', label: 'Lab technician' }, { value: 'PATHOLOGIST', label: 'Pathologist' }, { value: 'ADMIN', label: 'Admin' }];

export default async function AdminStaff() {
  const me = await requirePageUser('/admin/staff', ['ADMIN']);
  const staff = await db.user.findMany({ where: { role: { not: 'PATIENT' } }, orderBy: [{ role: 'asc' }, { name: 'asc' }] });
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="panel"><div className="tbl" style={{ marginTop: 0 }}>
        <table>
          <thead><tr><th>Name</th><th>Mobile</th><th>Role</th><th>Last login</th><th /></tr></thead>
          <tbody>
            {staff.map((u) => (
              <tr key={u.id}>
                <td>{u.name}{u.id === me.id ? ' (you)' : ''}</td><td>+91 {formatPhone(u.phone)}</td><td>{ROLES.find((r) => r.value === u.role)?.label}</td>
                <td className="muted">{u.lastLoginAt ? u.lastLoginAt.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' }) : 'never'}</td>
                <td>{u.id === me.id ? null : <ActionButton endpoint={`/api/admin/users/${u.id}`} method="PATCH" body={{ active: !u.active }} label={u.active ? 'Disable' : 'Enable'} done={u.active ? 'Account disabled' : 'Account enabled'} confirm={u.active ? `Disable ${u.name}? They will be signed out.` : undefined} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></div>
      <div className="panel">
        <h2 style={{ marginBottom: 6 }}>Add staff or change a role</h2>
        <p className="muted" style={{ marginTop: 0 }}>They sign in with their mobile number and a one-time code, like patients. Using the number of someone who is already registered changes their role and signs them out.</p>
        <AdminForm endpoint="/api/admin/staff" method="POST" submit="Add / update" done="Staff saved" initial={{ phone: '', name: '', role: 'PHLEBOTOMIST' }}
          fields={[{ name: 'name', label: 'Full name', type: 'text', maxLength: 80 }, { name: 'phone', label: 'Mobile number', type: 'text', maxLength: 14 }, { name: 'role', label: 'Role', type: 'select', options: ROLES }]} />
      </div>
    </div>
  );
}

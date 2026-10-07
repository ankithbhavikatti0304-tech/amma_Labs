import { db } from '@/server/db';
import { AdminForm } from '@/components/admin/AdminForm';
import { couponFields } from '@/components/admin/fields';

const istDay = (d: Date | null) => (d ? new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10) : '');

export default async function AdminCoupons() {
  const coupons = await db.coupon.findMany({ orderBy: { createdAt: 'asc' } });
  return (
    <div className="stack" style={{ gap: 18 }}>
      {coupons.map((c) => (
        <details key={c.code} className="panel">
          <summary style={{ cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <code className="mono" style={{ background: 'var(--mint)', padding: '2px 8px', borderRadius: 6 }}>{c.code}</code>
            <span>{c.description}</span>
            <span className="muted" style={{ fontSize: 13 }}>used {c.usedCount}{c.maxUses ? ` of ${c.maxUses}` : ''} · {c.active ? 'active' : 'off'}</span>
          </summary>
          <div style={{ marginTop: 16 }}>
            <AdminForm fields={couponFields} endpoint={`/api/admin/coupons/${c.code}`} done="Coupon saved" initial={{ ...c, startsAt: istDay(c.startsAt), endsAt: istDay(c.endsAt) }} />
          </div>
        </details>
      ))}
      <div className="panel">
        <h2 style={{ marginBottom: 14 }}>New coupon</h2>
        <AdminForm endpoint="/api/admin/coupons" method="POST" submit="Create coupon" done="Coupon created"
          fields={[{ name: 'code', label: 'Code', type: 'text', maxLength: 20, hint: 'Letters and numbers, e.g. DIWALI15' }, ...couponFields]}
          initial={{ code: '', description: '', type: 'PERCENT', value: '', cap: '', minOrder: 0, maxUses: '', startsAt: '', endsAt: '', active: true }} />
      </div>
    </div>
  );
}

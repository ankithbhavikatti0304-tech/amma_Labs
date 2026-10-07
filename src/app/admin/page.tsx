import Link from 'next/link';
import { db } from '@/server/db';
import { addDays, fromDbDate, istDate, longDate, toDbDate } from '@/lib/ist';
import { inr } from '@/lib/money';
import { STATUS_STEPS, statusIndex } from '@/lib/orders';
import type { OrderStatus } from '@/generated/prisma/enums';

const STATUSES: OrderStatus[] = ['BOOKED', 'SAMPLE_COLLECTED', 'PROCESSING', 'REPORT_READY', 'PENDING_PAYMENT', 'CANCELLED'];
const label = (s: OrderStatus) => (s === 'CANCELLED' ? 'Cancelled' : s === 'PENDING_PAYMENT' ? 'Awaiting payment' : STATUS_STEPS[statusIndex(s)]!);

export default async function AdminOrders({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = (await searchParams).status;
  const status = STATUSES.find((s) => s === (Array.isArray(raw) ? raw[0] : raw));
  const tomorrow = toDbDate(addDays(istDate(), 1));
  const [orders, byStatus, newCallbacks, newRx, pickupsTomorrow] = await Promise.all([
    db.order.findMany({ where: status ? { status } : {}, orderBy: { createdAt: 'desc' }, take: 100, include: { assignedTo: { select: { name: true } } } }),
    db.order.groupBy({ by: ['status'], _count: { _all: true } }),
    db.callbackRequest.count({ where: { status: 'NEW' } }),
    db.prescription.count({ where: { status: 'NEW' } }),
    db.order.count({ where: { slotDate: tomorrow, status: 'BOOKED', homeCollection: true } }),
  ]);
  const n = (s: OrderStatus) => byStatus.find((b) => b.status === s)?._count._all ?? 0;
  const stat = (k: string, v: number, href?: string) => <Link href={href ?? '#'} className="panel" style={{ textDecoration: 'none', color: 'inherit', padding: 16 }}><div className="muted" style={{ fontSize: 12.5, fontWeight: 700 }}>{k}</div><div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.03em' }}>{v}</div></Link>;
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
        {stat('Booked, to collect', n('BOOKED'), '/admin?status=BOOKED')}
        {stat('Pickups tomorrow', pickupsTomorrow, '/admin?status=BOOKED')}
        {stat('In the lab', n('SAMPLE_COLLECTED') + n('PROCESSING'), '/admin?status=PROCESSING')}
        {stat('Callback requests', newCallbacks, '/admin/inbox')}
        {stat('New prescriptions', newRx, '/admin/inbox')}
      </div>
      <div className="bar">
        <Link className="chip" href="/admin" aria-pressed={!status}>All</Link>
        {STATUSES.map((s) => <Link key={s} className="chip" href={`/admin?status=${s}`} aria-pressed={status === s}>{label(s)} · {n(s)}</Link>)}
      </div>
      <div className="panel"><div className="tbl" style={{ marginTop: 0 }}>
        <table>
          <thead><tr><th>Order</th><th>Patient</th><th>Slot</th><th>Status</th><th>Total</th><th>Payment</th><th>Assigned</th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td><Link className="link mono" href={`/staff/orders/${o.code}`}>{o.code}</Link></td>
                <td>{o.patientName}, {o.patientAge}</td>
                <td>{longDate(fromDbDate(o.slotDate))}, {o.slotLabel}</td>
                <td>{label(o.status)}</td>
                <td>{inr(o.total)}</td>
                <td>{o.payMode === 'COD' ? 'At collection' : 'Online'} · {o.paymentStatus.toLowerCase()}</td>
                <td>{o.assignedTo?.name ?? '—'}</td>
              </tr>
            ))}
            {!orders.length ? <tr><td colSpan={7} className="muted">No orders.</td></tr> : null}
          </tbody>
        </table>
      </div></div>
    </div>
  );
}

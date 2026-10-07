import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePageUser } from '@/server/auth/cookie';
import { db } from '@/server/db';
import { canReadResults, getEntryForm } from '@/server/results';
import { ApiError } from '@/server/http-errors';
import { orderCode } from '@/server/schemas';
import { ResultsForm } from '@/components/staff/ResultsForm';
import { AssignForm, PickupCard, ReasonAction, ReleaseButton } from '@/components/staff/Actions';
import { listPickups } from '@/server/staff';
import { fromDbDate, longDate } from '@/lib/ist';
import { GENDER_LABEL, STATUS_STEPS, statusIndex } from '@/lib/orders';
import { inr } from '@/lib/money';
import { formatPhone } from '@/lib/phone';

export default async function StaffOrder({ params }: { params: Promise<{ code: string }> }) {
  const user = await requirePageUser('/staff', ['PHLEBOTOMIST', 'TECHNICIAN', 'PATHOLOGIST']);
  const parsed = orderCode.safeParse((await params).code);
  if (!parsed.success) notFound();
  const order = await db.order.findUnique({ where: { code: parsed.data }, include: { user: { select: { phone: true } }, items: true, assignedTo: { select: { name: true } } } });
  if (!order) notFound();

  const role = user.role;
  const admin = role === 'ADMIN';
  const canEnter = admin || role === 'TECHNICIAN';
  const canRelease = admin || role === 'PATHOLOGIST';
  const canCollect = admin || role === 'PHLEBOTOMIST';

  let form: Awaited<ReturnType<typeof getEntryForm>> | null = null;
  // Result values are shown only to the roles that enter, verify or administer them (not to phlebotomists).
  if (canReadResults(user) && ['SAMPLE_COLLECTED', 'PROCESSING', 'REPORT_READY'].includes(order.status)) {
    try { form = await getEntryForm(order.code); } catch (e) { if (!(e instanceof ApiError)) throw e; }
  }
  const missing = form ? form.rows.filter((r) => r.value === '').length : 0;
  const phlebs = admin && order.status === 'BOOKED' ? await db.user.findMany({ where: { role: 'PHLEBOTOMIST', active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }) : [];
  const pickup = canCollect && order.status === 'BOOKED' && order.homeCollection ? (await listPickups(user, fromDbDate(order.slotDate))).find((p) => p.code === order.code) : null;

  return (
    <div className="stack" style={{ gap: 18 }}>
      <nav className="crumbs" style={{ paddingTop: 0 }} aria-label="Breadcrumb"><Link href="/staff">Work queue</Link><span>›</span><span className="mono">{order.code}</span></nav>
      <div className="panel">
        <div className="ohead">
          <div>
            <h2 style={{ fontSize: 22 }}>{order.patientName}, {order.patientAge} y · {GENDER_LABEL[order.patientGender]}</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}><span className="mono">{order.code}</span> · {longDate(fromDbDate(order.slotDate))}, {order.slotLabel} · {order.status === 'CANCELLED' ? 'Cancelled' : order.status === 'PENDING_PAYMENT' ? 'Awaiting payment' : STATUS_STEPS[statusIndex(order.status)]}</p>
          </div>
          <a className="btn ghost sm" href={`tel:+91${order.user.phone}`}>Call +91 {formatPhone(order.user.phone)}</a>
        </div>
        <div className="sum" style={{ fontWeight: 500, marginTop: 14 }}>
          <div><span>Tests</span><span style={{ textAlign: 'right' }}>{order.items.map((i) => i.name).join(', ')}</span></div>
          {order.addressLine ? <div><span>Address</span><span style={{ textAlign: 'right' }}>{order.addressLine}, {order.city} {order.pincode}</span></div> : null}
          <div><span>Payment</span><span>{order.payMode === 'COD' ? 'At collection' : 'Online'} · {inr(order.total)} · {order.paymentStatus.toLowerCase()}</span></div>
          {order.assignedTo ? <div><span>Assigned</span><span>{order.assignedTo.name}</span></div> : null}
        </div>
      </div>

      {order.status === 'BOOKED' ? (
        <div className="panel">
          <h2 style={{ marginBottom: 12 }}>Collect sample</h2>
          {pickup ? <PickupCard p={pickup} /> : canCollect ? <p className="muted">This is a centre visit. Collect the sample at the centre and mark it here.</p> : <p className="muted">Waiting for the sample to be collected.</p>}
          {admin ? <div style={{ marginTop: 14 }}><h3 style={{ fontSize: 15, marginBottom: 8 }}>Assign phlebotomist</h3><AssignForm code={order.code} current={order.assignedToId} staff={phlebs} /></div> : null}
        </div>
      ) : null}

      {form && order.status !== 'REPORT_READY' ? (
        <div className="panel">
          <h2 style={{ marginBottom: 12 }}>{canEnter ? 'Enter results' : 'Results'}</h2>
          <ResultsForm code={order.code} rows={form.rows} editable={canEnter && order.status !== 'CANCELLED'} />
        </div>
      ) : null}

      {form && order.status === 'PROCESSING' && canRelease ? (
        <div className="panel">
          <h2 style={{ marginBottom: 12 }}>Verify and release</h2>
          <p className="muted" style={{ marginTop: 0 }}>Check each value and flag above. Releasing publishes the report to the patient and locks the results.</p>
          <ReleaseButton code={order.code} ready={missing === 0} missing={missing} />
        </div>
      ) : null}

      {order.status === 'REPORT_READY' ? (
        <div className="panel">
          <h2 style={{ marginBottom: 12 }}>Report released</h2>
          <div className="bar"><Link className="btn" href={`/orders/${order.code}/report`}>Open report</Link></div>
          {admin ? <div style={{ marginTop: 16 }}><ReasonAction endpoint={`/api/staff/orders/${order.code}/reopen`} label="Reason for reopening to correct a result" button="Reopen report" done="Report reopened" /></div> : null}
        </div>
      ) : null}

      {admin && order.status !== 'CANCELLED' && order.status !== 'REPORT_READY' ? (
        <div className="panel"><h2 style={{ marginBottom: 12 }}>Cancel order</h2><ReasonAction endpoint={`/api/staff/orders/${order.code}/cancel`} label="Reason (patient unreachable, duplicate...)" button="Cancel order" done="Order cancelled" /></div>
      ) : null}
    </div>
  );
}

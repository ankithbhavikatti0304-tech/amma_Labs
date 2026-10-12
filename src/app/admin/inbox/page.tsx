import { db } from '@/server/db';
import { AdminForm } from '@/components/admin/AdminForm';
import { formatPhone } from '@/lib/phone';

const when = (d: Date) => d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default async function Inbox() {
  const [callbacks, rx] = await Promise.all([
    db.callbackRequest.findMany({ where: { status: { not: 'CLOSED' } }, orderBy: { createdAt: 'asc' }, take: 100 }),
    db.prescription.findMany({ where: { status: { in: ['NEW', 'REVIEWED'] } }, orderBy: { createdAt: 'asc' }, take: 100, include: { user: { select: { name: true, phone: true } } } }),
  ]);
  return (
    <div className="stack" style={{ gap: 28 }}>
      <section>
        <h2 style={{ marginBottom: 12 }}>Call-back requests</h2>
        {callbacks.length ? <div className="olist">{callbacks.map((c) => (
          <div className="panel" key={c.id}>
            <div className="ohead"><div><b>+91 {formatPhone(c.phone)}</b><div className="muted" style={{ fontSize: 13 }}>{when(c.createdAt)}{c.name ? ` · ${c.name}` : ''}</div></div><a className="btn ghost sm" href={`tel:+91${c.phone}`}>Call</a></div>
            <div style={{ marginTop: 12 }}><AdminForm compact endpoint={`/api/admin/callbacks/${c.id}`} done="Updated" initial={c}
              fields={[{ name: 'status', label: 'Status', type: 'select', options: [{ value: 'NEW', label: 'New' }, { value: 'CONTACTED', label: 'Contacted' }, { value: 'CLOSED', label: 'Closed' }] }, { name: 'note', label: 'Note', type: 'text', maxLength: 300 }]} /></div>
          </div>
        ))}</div> : <div className="empty" style={{ padding: 24 }}>No open requests.</div>}
      </section>
      <section>
        <h2 style={{ marginBottom: 12 }}>Prescriptions</h2>
        {rx.length ? <div className="olist">{rx.map((p) => (
          <div className="panel" key={p.id}>
            <div className="ohead"><div><b>{p.user.name} · +91 {formatPhone(p.user.phone)}</b><div className="muted" style={{ fontSize: 13 }}>{when(p.createdAt)} · {Math.max(1, Math.round(p.sizeBytes / 1024))} KB</div></div>
              <a className="btn ghost sm" href={`/api/prescriptions/${p.id}/file`}>Download</a></div>
            <div style={{ marginTop: 12 }}><AdminForm compact endpoint={`/api/admin/prescriptions/${p.id}`} done="Updated" initial={p}
              fields={[{ name: 'status', label: 'Status', type: 'select', options: [{ value: 'NEW', label: 'New' }, { value: 'REVIEWED', label: 'Reviewed' }, { value: 'CONVERTED', label: 'Booked for patient' }, { value: 'REJECTED', label: 'Not usable' }] }, { name: 'note', label: 'Note', type: 'text', maxLength: 300 }]} /></div>
          </div>
        ))}</div> : <div className="empty" style={{ padding: 24 }}>No prescriptions waiting.</div>}
      </section>
    </div>
  );
}

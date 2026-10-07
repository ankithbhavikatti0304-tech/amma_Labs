import Link from 'next/link';
import { requirePageUser } from '@/server/auth/cookie';
import { listLabQueue, listPickups, type QueueRow } from '@/server/staff';
import { PickupCard } from '@/components/staff/Actions';
import { addDays, istDate, isIsoDate, longDate } from '@/lib/ist';

type SP = Promise<Record<string, string | string[] | undefined>>;

function Queue({ rows, empty }: { rows: QueueRow[]; empty: string }) {
  if (!rows.length) return <div className="empty" style={{ padding: 24 }}>{empty}</div>;
  return (
    <div className="olist">
      {rows.map((r) => (
        <Link key={r.code} href={`/staff/orders/${r.code}`} className="panel" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
          <div className="ohead">
            <div><b>{r.patientName}</b><div className="muted" style={{ fontSize: 13 }}><span className="mono">{r.code}</span> · {r.tests.join(', ')}</div></div>
            <span className={`flag ${r.entered >= r.expected && r.expected > 0 ? 'n' : 'l'}`}>{r.entered} of {r.expected} results</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default async function StaffHome({ searchParams }: { searchParams: SP }) {
  const user = await requirePageUser('/staff', ['PHLEBOTOMIST', 'TECHNICIAN', 'PATHOLOGIST']);
  const sp = await searchParams;
  const raw = Array.isArray(sp.date) ? sp.date[0] : sp.date;
  const today = istDate();
  const date = raw && isIsoDate(raw) ? raw : today;
  const admin = user.role === 'ADMIN';
  const showPickups = admin || user.role === 'PHLEBOTOMIST';
  const showEntry = admin || user.role === 'TECHNICIAN';
  const showReview = admin || user.role === 'PATHOLOGIST';

  const [pickups, lab] = await Promise.all([showPickups ? listPickups(user, date) : [], showEntry || showReview ? listLabQueue(['SAMPLE_COLLECTED', 'PROCESSING']) : []]);
  const toEnter = lab.filter((r) => r.entered < r.expected || r.expected === 0);
  const toReview = lab.filter((r) => r.status === 'PROCESSING' && r.entered >= r.expected && r.expected > 0);

  return (
    <div className="stack" style={{ gap: 28 }}>
      {showPickups ? (
        <section>
          <div className="sec-head" style={{ marginBottom: 12 }}>
            <h2>Pickups · {longDate(date)}</h2>
            <div className="bar">{[0, 1, 2].map((n) => { const d = addDays(today, n); return <Link key={d} className="chip" href={`/staff?date=${d}`} aria-pressed={d === date}>{n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : longDate(d)}</Link>; })}</div>
          </div>
          {pickups.length ? <div className="olist">{pickups.map((p) => <PickupCard key={p.code} p={p} />)}</div> : <div className="empty" style={{ padding: 24 }}>No pickups for this day.</div>}
        </section>
      ) : null}
      {showEntry ? (
        <section>
          <h2 style={{ marginBottom: 12 }}>Results to enter</h2>
          <Queue rows={toEnter} empty="Nothing waiting. Samples show up here once they are collected." />
        </section>
      ) : null}
      {showReview ? (
        <section>
          <h2 style={{ marginBottom: 12 }}>Ready to verify</h2>
          <Queue rows={toReview} empty="No reports waiting for your review." />
        </section>
      ) : null}
    </div>
  );
}

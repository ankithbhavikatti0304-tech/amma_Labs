import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getUser } from '@/server/auth/cookie';
import { getReport } from '@/server/results';
import { ApiError } from '@/server/http-errors';
import { orderCode } from '@/server/schemas';
import { LoginPrompt } from '@/components/orders/OrderParts';
import { Icon } from '@/components/Icon';
import { GENDER_LABEL } from '@/lib/orders';
import { FLAG_LABEL } from '@/lib/results';

export const metadata: Metadata = { title: 'Lab report', robots: { index: false, follow: false } };

const FLAG_CLASS = { NORMAL: 'n', HIGH: 'h', LOW: 'l', ABNORMAL: 'h' } as const;

export default async function ReportPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await getUser();
  const crumbs = (
    <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>›</span><Link href="/orders">My orders &amp; reports</Link><span>›</span><span>Report</span></nav>
  );
  if (!user) return <div className="wrap">{crumbs}<LoginPrompt next={`/orders/${code}/report`} /></div>;
  const parsed = orderCode.safeParse(code);
  if (!parsed.success) notFound();

  let r;
  try {
    r = await getReport(user, parsed.data);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      if (e.code === 'not_ready') return <div className="wrap">{crumbs}<div className="empty"><b>Your report isn&apos;t ready yet.</b><span>We&apos;ll message you the moment it is. You can follow progress on the order.</span><Link className="btn" href={`/orders/${parsed.data}`}>Track order</Link></div></div>;
      notFound();
    }
    throw e;
  }

  return (
    <div className="wrap">
      {crumbs}
      <div className="lhead">
        <div><h1>Lab report</h1></div>
        <div className="bar">
          <a className="btn" href={`/api/orders/${r.code}/report`} download><Icon name="rx" size={18} /> Download PDF</a>
          <a className="btn ghost" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`My Amma Labs report for order ${r.code} is ready.`)}`}><Icon name="wa" size={18} /> Share on WhatsApp</a>
        </div>
      </div>
      <div className="panel">
        <div className="rep-meta">
          <div><span>Patient</span><b>{r.patient.name}</b>, {r.patient.age} y · {GENDER_LABEL[r.patient.gender]}</div>
          <div><span>Order ID</span><b className="mono">{r.code}</b></div>
          <div><span>Sample collected</span><b>{r.collected}</b></div>
          <div><span>Verified by</span><b>{r.verifiedBy}</b></div>
        </div>
        <div className="rep-sum">
          <span className="flag n">{r.summary.within} within range</span>
          {r.summary.outside ? <span className="flag h">{r.summary.outside} outside range</span> : null}
        </div>
        <div className="tbl">
          <table>
            <thead><tr><th>Parameter</th><th>Result</th><th>Unit</th><th>Reference range</th><th>Where it sits</th><th>Flag</th></tr></thead>
            <tbody>
              {r.tests.map((t) => (
                <ReportBlock key={t.id} t={t} />
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: 12.5, margin: '14px 0 0' }}>Reference ranges are for adults and can vary with age and sex. Discuss any flagged value with your doctor.</p>
      </div>
    </div>
  );
}

function ReportBlock({ t }: { t: Awaited<ReturnType<typeof getReport>>['tests'][number] }) {
  return (
    <>
      <tr><td colSpan={6} style={{ paddingTop: 18, borderBottom: 0 }}><b style={{ fontSize: 16 }}>{t.name}</b></td></tr>
      {t.groups.map((g, gi) => (
        <GroupRows key={gi} g={g} />
      ))}
    </>
  );
}

function GroupRows({ g }: { g: Awaited<ReturnType<typeof getReport>>['tests'][number]['groups'][number] }) {
  return (
    <>
      {g.heading ? <tr className="grp"><td colSpan={6}>{g.heading}</td></tr> : null}
      {g.rows.map((row) => (
        <tr key={row.name}>
          <td>{row.name}</td>
          <td className="v">{row.value}</td>
          <td className="muted">{row.unit}</td>
          <td className="muted">{row.range ?? '—'}</td>
          <td>{row.position !== null ? <div className="rbar" aria-hidden="true"><b style={{ left: `${row.position}%` }} /></div> : null}</td>
          <td><span className={`flag ${FLAG_CLASS[row.flag]}`}>{FLAG_LABEL[row.flag]}</span></td>
        </tr>
      ))}
    </>
  );
}

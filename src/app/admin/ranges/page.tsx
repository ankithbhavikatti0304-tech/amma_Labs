import Link from 'next/link';
import { db } from '@/server/db';

export default async function AdminRanges() {
  const params = await db.parameter.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { ranges: true, tests: true } } } });
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="note info">The ranges below are rough adult ranges from the prototype. The lab must replace them with its own, and add sex- and age-specific rules where they differ. A range change applies to results entered from now on; reports already released keep the range they were flagged against.</div>
      <div className="bar"><Link className="btn sm" href="/admin/ranges/new">Add a parameter</Link></div>
      <div className="panel"><div className="tbl" style={{ marginTop: 0 }}>
        <table>
          <thead><tr><th>Parameter</th><th>Type</th><th>Unit</th><th>Default range</th><th>Sex / age rules</th><th>Used in</th></tr></thead>
          <tbody>
            {params.map((p) => (
              <tr key={p.id}>
                <td><Link className="link" href={`/admin/ranges/${p.id}`}>{p.name}</Link></td>
                <td className="muted">{p.kind === 'NUMERIC' ? 'Number' : p.kind === 'CHOICE' ? 'List' : 'Text'}</td>
                <td className="muted">{p.unit}</td>
                <td>{p.kind === 'NUMERIC' ? `${p.refLow?.toString() ?? '—'} – ${p.refHigh?.toString() ?? '—'}` : p.refText ?? '—'}</td>
                <td>{p.kind === 'NUMERIC' ? (p._count.ranges ? `${p._count.ranges} rule${p._count.ranges > 1 ? 's' : ''}` : <span className="muted">none</span>) : ''}</td>
                <td className="muted">{p._count.tests} test{p._count.tests === 1 ? '' : 's'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></div>
    </div>
  );
}

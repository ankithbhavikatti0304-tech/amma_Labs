import Link from 'next/link';
import { db } from '@/server/db';
import { inr } from '@/lib/money';
import { tatRange } from '@/lib/catalogue';

export default async function AdminTests() {
  const tests = await db.test.findMany({ orderBy: { sort: 'asc' }, include: { categories: { select: { category: { select: { name: true } } } }, _count: { select: { parameters: true } } } });
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="note info">All prices below came from the prototype and are placeholders. Replace them with the lab&apos;s real prices before launch.</div>
      <div className="bar"><Link className="btn sm" href="/admin/tests/new">Add a test</Link></div>
      <div className="panel"><div className="tbl" style={{ marginTop: 0 }}>
        <table>
          <thead><tr><th>Test</th><th>Category</th><th>Price</th><th>MRP</th><th>Report</th><th>Results</th><th>Status</th></tr></thead>
          <tbody>
            {tests.map((t) => (
              <tr key={t.id}>
                <td><Link className="link" href={`/admin/tests/${t.id}`}>{t.name}</Link></td>
                <td className="muted">{t.categories.map((c) => c.category.name).join(', ')}</td>
                <td>{inr(t.price)}</td><td className="muted">{inr(t.mrp)}</td>
                <td className="muted">{tatRange({ tatMin: t.tatMinHours, tatMax: t.tatMaxHours })} h</td>
                <td>{t._count.parameters ? `${t._count.parameters} parameters` : <span className="flag l">None set</span>}</td>
                <td>{t.active ? 'Active' : <span className="flag h">Hidden</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></div>
    </div>
  );
}

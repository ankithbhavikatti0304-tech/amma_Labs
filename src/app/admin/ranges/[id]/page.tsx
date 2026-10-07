import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/server/db';
import { ActionButton, AdminForm, type FieldDef } from '@/components/admin/AdminForm';
import { parameterFields } from '@/components/admin/fields';

const rangeFields: FieldDef[] = [
  { name: 'sex', label: 'Sex', type: 'select', options: [{ value: '', label: 'Any' }, { value: 'MALE', label: 'Male' }, { value: 'FEMALE', label: 'Female' }, { value: 'OTHER', label: 'Other' }] },
  { name: 'ageMin', label: 'Age from', type: 'number' }, { name: 'ageMax', label: 'Age to', type: 'number' },
  { name: 'low', label: 'Normal from', type: 'number' }, { name: 'high', label: 'Normal up to', type: 'number' },
];

export default async function EditParameter({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await db.parameter.findUnique({ where: { id }, include: { ranges: { orderBy: [{ sex: 'asc' }, { ageMin: 'asc' }] } } });
  if (!p) notFound();
  return (
    <div className="stack" style={{ gap: 18 }}>
      <nav className="crumbs" style={{ paddingTop: 0 }}><Link href="/admin/ranges">Reference ranges</Link><span>›</span><span>{p.name}</span></nav>
      <div className="panel">
        <h2 style={{ marginBottom: 14 }}>{p.name}</h2>
        <AdminForm fields={parameterFields} endpoint={`/api/admin/parameters/${p.id}`} done="Parameter saved"
          initial={{ ...p, refLow: p.refLow?.toString() ?? '', refHigh: p.refHigh?.toString() ?? '', options: p.options.join('\n'), refText: p.refText ?? '' }} />
      </div>
      {p.kind === 'NUMERIC' ? (
        <div className="panel">
          <h2 style={{ marginBottom: 6 }}>Sex and age rules</h2>
          <p className="muted" style={{ marginTop: 0 }}>The most specific matching rule is used for each patient; if none matches, the default range above applies.</p>
          {p.ranges.length ? (
            <div className="tbl" style={{ marginTop: 0, marginBottom: 16 }}><table style={{ minWidth: 420 }}>
              <thead><tr><th>Sex</th><th>Age</th><th>Normal range</th><th /></tr></thead>
              <tbody>{p.ranges.map((r) => (
                <tr key={r.id}><td>{r.sex ? r.sex.toLowerCase() : 'any'}</td><td>{r.ageMin ?? 0}–{r.ageMax ?? 'up'}</td><td>{r.low.toString()} – {r.high.toString()} {p.unit}</td>
                  <td><ActionButton endpoint={`/api/admin/ranges/${r.id}`} method="DELETE" label="Remove" done="Rule removed" confirm="Remove this rule?" /></td></tr>
              ))}</tbody>
            </table></div>
          ) : null}
          <AdminForm compact fields={rangeFields} endpoint={`/api/admin/parameters/${p.id}/ranges`} method="POST" submit="Add rule" done="Rule added" initial={{ sex: '', ageMin: '', ageMax: '', low: '', high: '' }} />
        </div>
      ) : null}
    </div>
  );
}

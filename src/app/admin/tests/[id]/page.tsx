import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/server/db';
import { AdminForm } from '@/components/admin/AdminForm';
import { ParametersEditor } from '@/components/admin/ParametersEditor';
import { testFields } from '@/components/admin/fields';

export default async function EditTest({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, categories, allParams] = await Promise.all([
    db.test.findUnique({ where: { id }, include: { categories: { select: { categoryId: true } }, parameters: { orderBy: { position: 'asc' } } } }),
    db.category.findMany({ orderBy: { sort: 'asc' }, select: { id: true, name: true } }),
    db.parameter.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  if (!t) notFound();
  return (
    <div className="stack" style={{ gap: 18 }}>
      <nav className="crumbs" style={{ paddingTop: 0 }}><Link href="/admin/tests">Tests &amp; prices</Link><span>›</span><span>{t.name}</span></nav>
      <div className="panel">
        <h2 style={{ marginBottom: 14 }}>Details and price</h2>
        <AdminForm fields={testFields(categories)} endpoint={`/api/admin/tests/${t.id}`} done="Test saved"
          initial={{ ...t, categories: t.categories.map((c) => c.categoryId), includes: t.includes.join('\n') }} />
      </div>
      <div className="panel">
        <h2 style={{ marginBottom: 6 }}>Results this test reports</h2>
        <p className="muted" style={{ marginTop: 0 }}>These are the values the lab technician enters and that appear on the report. Add new parameters under Reference ranges.</p>
        <ParametersEditor testId={t.id} all={allParams} initial={t.parameters.map((p) => ({ parameterId: p.parameterId, groupName: p.groupName ?? '' }))} />
      </div>
    </div>
  );
}

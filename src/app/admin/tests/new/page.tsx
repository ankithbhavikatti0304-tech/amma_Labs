import { db } from '@/server/db';
import { AdminForm } from '@/components/admin/AdminForm';
import { testFields } from '@/components/admin/fields';

export default async function NewTest() {
  const categories = await db.category.findMany({ orderBy: { sort: 'asc' }, select: { id: true, name: true } });
  return (
    <div className="panel">
      <h2 style={{ marginBottom: 14 }}>Add a test</h2>
      <AdminForm
        fields={testFields(categories)} endpoint="/api/admin/tests" method="POST" submit="Create test" done="Test created"
        redirect={(r) => `/admin/tests/${(r as { id: string }).id}`}
        initial={{ name: '', price: '', mrp: '', tatMinHours: 12, tatMaxHours: 24, parameterCount: '', tint: 'a', mascot: 'drop', mascotArg: '', categories: [], includes: '', isPackage: false, fasting: false, morningSample: false, centreVisit: false, popular: false, active: true }}
      />
    </div>
  );
}

import { AdminForm } from '@/components/admin/AdminForm';
import { parameterFields } from '@/components/admin/fields';

export default function NewParameter() {
  return (
    <div className="panel">
      <h2 style={{ marginBottom: 14 }}>Add a parameter</h2>
      <AdminForm fields={parameterFields} endpoint="/api/admin/parameters" method="POST" submit="Create parameter" done="Parameter created" redirect={(r) => `/admin/ranges/${(r as { id: string }).id}`}
        initial={{ name: '', kind: 'NUMERIC', unit: '', decimals: 1, refLow: '', refHigh: '', options: '', refText: '' }} />
    </div>
  );
}

import { loadSettings } from '@/server/settings';
import { AdminForm } from '@/components/admin/AdminForm';

export default async function AdminSettings() {
  const s = await loadSettings();
  return (
    <div className="panel">
      <h2 style={{ marginBottom: 6 }}>Lab details and fees</h2>
      <p className="muted" style={{ marginTop: 0 }}>These show across the site straight away. The phone and WhatsApp numbers are placeholders until you set them.</p>
      <AdminForm endpoint="/api/admin/settings" method="PUT" done="Settings saved" initial={{ ...s }}
        fields={[
          { name: 'phone', label: 'Lab phone (as shown)', type: 'text', maxLength: 20 },
          { name: 'whatsapp', label: 'WhatsApp number', type: 'text', maxLength: 15, hint: 'Digits only with country code, e.g. 919876543210' },
          { name: 'hours', label: 'Opening hours', type: 'text', maxLength: 60 },
          { name: 'pathologistTitle', label: 'Title printed under “Verified by”', type: 'text', maxLength: 80 },
          { name: 'freeCollectionAbove', label: 'Free home collection from (₹)', type: 'number' },
          { name: 'collectionFee', label: 'Home collection fee (₹)', type: 'number' },
          { name: 'hardCopyFee', label: 'Hard copy of reports (₹)', type: 'number' },
        ]} />
    </div>
  );
}

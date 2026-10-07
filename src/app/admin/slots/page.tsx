import { db } from '@/server/db';
import { AdminForm } from '@/components/admin/AdminForm';

export default async function AdminSlots() {
  const slots = await db.slot.findMany({ orderBy: { sort: 'asc' } });
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="note info">Capacity is how many bookings a window takes per day. The numbers here are placeholders: set them to what your phlebotomists can really cover. Morning windows are the only ones offered when a test needs fasting.</div>
      {slots.map((s) => (
        <div className="panel" key={s.id}>
          <AdminForm compact endpoint={`/api/admin/slots/${s.id}`} done="Slot saved" initial={s}
            fields={[{ name: 'label', label: 'Window', type: 'text', maxLength: 30 }, { name: 'capacity', label: 'Bookings per day', type: 'number' }, { name: 'morning', label: 'Morning slot', type: 'checkbox' }, { name: 'active', label: 'Open', type: 'checkbox' }]} />
        </div>
      ))}
    </div>
  );
}

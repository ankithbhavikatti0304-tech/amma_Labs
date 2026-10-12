'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ActionButton } from '@/components/admin/AdminForm';
import { ApiFailure, apiPost } from '@/lib/client/api';
import { toast } from '@/lib/client/ui';

export const RemoveButton = ({ endpoint, label }: { endpoint: string; label: string }) => (
  <ActionButton endpoint={endpoint} method="DELETE" label="Remove" done={`${label} removed`} confirm={`Remove this ${label.toLowerCase()} from your saved details? Past orders are not affected.`} />
);

export function DeleteRequest() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" className="btn ghost sm" disabled={busy} onClick={async () => {
      if (!window.confirm('Ask Amma Labs to erase your account and data? A member of our team will contact you to confirm. Records we are required by law to keep will be kept.')) return;
      setBusy(true);
      try { await apiPost('/api/account/delete-request'); toast('Request sent. We will contact you.'); router.refresh(); }
      catch (e) { toast(e instanceof ApiFailure ? e.message : 'Something went wrong.'); }
      finally { setBusy(false); }
    }}>Ask us to delete my account</button>
  );
}

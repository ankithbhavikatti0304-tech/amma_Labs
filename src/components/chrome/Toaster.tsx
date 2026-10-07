'use client';
import { useState } from 'react';
import { useToast } from '@/lib/client/ui';
import { Icon } from '@/components/Icon';

export function Toaster() {
  const t = useToast();
  // Keep the text while it fades out.
  const [last, setLast] = useState('');
  if (t && t.msg !== last) setLast(t.msg);
  return (
    <div className={`toast${t ? ' show' : ''}`} role="status" aria-live="polite">
      <i><Icon name="check" size={12} /></i>
      {t?.msg ?? last}
    </div>
  );
}

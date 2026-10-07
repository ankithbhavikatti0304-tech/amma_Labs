'use client';
import { useEffect, useRef } from 'react';
import { useToast } from '@/lib/client/ui';
import { Icon } from '@/components/Icon';

export function Toaster() {
  const t = useToast();
  const last = useRef('');
  useEffect(() => {
    if (t) last.current = t.msg;
  }, [t]);
  return (
    <div className={`toast${t ? ' show' : ''}`} role="status" aria-live="polite">
      <i><Icon name="check" size={12} /></i>
      {t?.msg ?? last.current}
    </div>
  );
}

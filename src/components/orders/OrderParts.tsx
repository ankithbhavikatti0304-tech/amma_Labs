'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiFailure, apiPost } from '@/lib/client/api';
import { openSheet, toast } from '@/lib/client/ui';
import { STATUS_STEPS, statusIndex, type OrderDTO } from '@/lib/orders';

export function Tracker({ status }: { status: OrderDTO['status'] }) {
  const at = statusIndex(status);
  return (
    <div className="track" role="list" aria-label="Order progress">
      {STATUS_STEPS.map((s, i) => <div key={s} role="listitem" className={i <= at ? 'done' : ''} aria-current={i === at ? 'step' : undefined}><i />{s}</div>)}
    </div>
  );
}

export function CancelButton({ code }: { code: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="rm"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm('Cancel this booking? You can book again any time.')) return;
        setBusy(true);
        try {
          await apiPost(`/api/orders/${code}/cancel`);
          toast('Booking cancelled');
          router.refresh();
        } catch (e) {
          toast(e instanceof ApiFailure ? e.message : 'Could not cancel. Please call us.');
        } finally { setBusy(false); }
      }}
    >
      Cancel booking
    </button>
  );
}

export function LoginPrompt({ next }: { next: string }) {
  return (
    <div className="empty">
      <p>Log in with your mobile number to see your orders and reports.</p>
      <button type="button" className="btn" onClick={() => openSheet({ kind: 'login', next })}>Log in</button>
    </div>
  );
}

/** The right action for an order, wherever it appears. */
export function OrderActions({ o }: { o: OrderDTO }) {
  return (
    <div className="bar">
      {o.status === 'REPORT_READY' ? <Link className="btn" href={`/orders/${o.code}/report`}>View report</Link> : null}
      {o.status === 'PENDING_PAYMENT' ? <Link className="btn" href={`/orders/${o.code}/pay`}>Pay now</Link> : null}
      {o.cancellable ? <CancelButton code={o.code} /> : null}
    </div>
  );
}

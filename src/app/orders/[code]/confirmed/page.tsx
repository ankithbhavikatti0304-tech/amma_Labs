import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/server/auth/cookie';
import { loadOrder } from '@/server/order-page';
import { LoginPrompt, Tracker } from '@/components/orders/OrderParts';
import { Icon } from '@/components/Icon';
import { formatPhone } from '@/lib/phone';
import { slotText } from '@/lib/orders';

export const metadata: Metadata = { title: 'Booking confirmed', robots: { index: false } };

export default async function Confirmed({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { order: o } = await loadOrder(code);
  const user = await getUser();
  if (!o || !user) return <div className="wrap"><LoginPrompt next={`/orders/${code}/confirmed`} /></div>;
  if (o.status === 'PENDING_PAYMENT') redirect(`/orders/${o.code}/pay`);
  return (
    <div className="wrap" style={{ maxWidth: 640, paddingBlock: 40 }}>
      <div className="panel" style={{ textAlign: 'center', display: 'grid', gap: 10, justifyItems: 'center', padding: '32px 20px' }}>
        <span className="ok-ic"><Icon name="check" size={28} /></span>
        <h1 style={{ fontSize: 28 }}>Booking confirmed</h1>
        <p className="muted" style={{ margin: 0 }}>Order <span className="mono">{o.code}</span> · {slotText(o)}</p>
        <p style={{ margin: 0, maxWidth: '44ch' }}>We&apos;ll message {o.patientName} on +91 {formatPhone(user.phone)} when the phlebotomist is on the way.</p>
        <div style={{ width: '100%', textAlign: 'left' }}><Tracker status={o.status} /></div>
        <div className="bar" style={{ justifyContent: 'center' }}>
          <Link className="btn" href={`/orders/${o.code}`}>Track order</Link>
          <Link className="btn ghost" href="/">Back to home</Link>
        </div>
      </div>
    </div>
  );
}

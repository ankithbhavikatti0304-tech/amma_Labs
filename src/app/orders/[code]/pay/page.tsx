import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/server/auth/cookie';
import { loadOrder } from '@/server/order-page';
import { LoginPrompt } from '@/components/orders/OrderParts';
import { PayPanel } from '@/components/checkout/PayPanel';
import { slotText } from '@/lib/orders';
import { inr } from '@/lib/money';

export const metadata: Metadata = { title: 'Pay', robots: { index: false } };

export default async function PayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [{ order: o }, user] = await Promise.all([loadOrder(code), getUser()]);
  if (!o || !user) return <div className="wrap"><LoginPrompt next={`/orders/${code}/pay`} /></div>;
  if (o.status === 'BOOKED' || o.paymentStatus === 'PAID') redirect(`/orders/${o.code}/confirmed`);
  return (
    <div className="wrap" style={{ maxWidth: 520, paddingBlock: 36 }}>
      <nav className="crumbs" style={{ paddingTop: 0 }} aria-label="Breadcrumb"><Link href="/orders">My orders &amp; reports</Link><span>›</span><span className="mono">{o.code}</span></nav>
      <div className="panel" style={{ marginTop: 14 }}>
        <h1 style={{ fontSize: 26, marginBottom: 4 }}>Pay {inr(o.total)}</h1>
        <p className="muted" style={{ marginTop: 0 }}>Order <span className="mono">{o.code}</span> · {slotText(o)}</p>
        {o.status === 'PENDING_PAYMENT' && o.holdExpiresAt
          ? <PayPanel code={o.code} total={o.total} expiresAt={o.holdExpiresAt} phone={user.phone} />
          : <div className="note">This order is not waiting for payment. <Link className="link" href={`/orders/${o.code}`}>View order</Link></div>}
      </div>
    </div>
  );
}

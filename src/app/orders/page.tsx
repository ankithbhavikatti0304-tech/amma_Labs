import type { Metadata } from 'next';
import Link from 'next/link';
import { getUser } from '@/server/auth/cookie';
import { listOrders } from '@/server/orders';
import { LoginPrompt, OrderActions, Tracker } from '@/components/orders/OrderParts';
import { inr } from '@/lib/money';
import { slotText } from '@/lib/orders';
import { formatPhone } from '@/lib/phone';
import { LogoutButton } from '@/components/orders/LogoutButton';

export const metadata: Metadata = { title: 'My orders & reports', robots: { index: false } };

export default async function OrdersPage() {
  const user = await getUser();
  const orders = user ? await listOrders(user.id) : [];
  return (
    <div className="wrap">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>›</span><span>My orders &amp; reports</span></nav>
      <div className="lhead">
        <div><h1>My orders &amp; reports</h1></div>
        {user ? <div className="bar"><span className="muted">{user.name} · +91 {formatPhone(user.phone)}</span><LogoutButton /></div> : null}
      </div>
      {!user ? <LoginPrompt next="/orders" /> : orders.length ? (
        <div className="olist">
          {orders.map((o) => (
            <div className="panel" key={o.id}>
              <div className="ohead">
                <div>
                  <b><Link href={`/orders/${o.code}`}>{o.items.map((i) => i.name).join(', ')}</Link></b>
                  <div className="muted" style={{ fontSize: 13 }}><span className="mono">{o.code}</span> · {slotText(o)} · {inr(o.total)}{o.status === 'CANCELLED' ? ' · Cancelled' : ''}{o.status === 'PENDING_PAYMENT' ? ' · Awaiting payment' : ''}</div>
                </div>
                <OrderActions o={o} />
              </div>
              {o.status !== 'CANCELLED' ? <Tracker status={o.status} /> : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty"><p>No orders yet. Book a test and you can track it and read the report here.</p><Link className="btn" href="/category/full">Browse packages</Link></div>
      )}
    </div>
  );
}

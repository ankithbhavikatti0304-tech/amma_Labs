import type { Metadata } from 'next';
import Link from 'next/link';
import { loadOrder } from '@/server/order-page';
import { LoginPrompt, OrderActions, Tracker } from '@/components/orders/OrderParts';
import { inr } from '@/lib/money';
import { GENDER_LABEL, slotText } from '@/lib/orders';

export const metadata: Metadata = { title: 'Order', robots: { index: false } };

export default async function OrderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { order: o } = await loadOrder(code);
  return (
    <div className="wrap">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>›</span><Link href="/orders">My orders &amp; reports</Link><span>›</span><span className="mono">{code}</span></nav>
      {!o ? <LoginPrompt next={`/orders/${code}`} /> : (
        <div className="two">
          <div className="stack">
            <div className="panel">
              <div className="ohead">
                <div><h1 style={{ fontSize: 24 }}>Order <span className="mono">{o.code}</span></h1><p className="muted" style={{ marginTop: 4 }}>{o.status === 'CANCELLED' ? 'Cancelled' : o.status === 'PENDING_PAYMENT' ? 'Awaiting payment' : slotText(o)}</p></div>
                <OrderActions o={o} />
              </div>
              {o.status === 'CANCELLED' ? <div className="note" style={{ marginTop: 14 }}>This booking was cancelled.</div> : o.status === 'PENDING_PAYMENT' ? <div className="note" style={{ marginTop: 14 }}>Your slot is held for 15 minutes while we wait for payment.</div> : <Tracker status={o.status} />}
            </div>
            <div className="panel">
              <h2 style={{ marginBottom: 8 }}>Tests</h2>
              {o.items.map((i) => <div className="citem" key={i.testId}><div className="grow"><b>{i.name}</b></div><span style={{ fontWeight: 700 }}>{inr(i.price)}</span></div>)}
            </div>
          </div>
          <div className="stack">
            <div className="panel">
              <h2 style={{ marginBottom: 12 }}>Details</h2>
              <div className="sum" style={{ fontWeight: 500 }}>
                <div><span>Patient</span><span style={{ textAlign: 'right' }}>{o.patientName}, {o.patientAge} y · {GENDER_LABEL[o.patientGender]}</span></div>
                <div><span>{o.homeCollection ? 'Collection' : 'Visit'}</span><span style={{ textAlign: 'right' }}>{slotText(o)}</span></div>
                {o.homeCollection ? <div><span>Address</span><span style={{ textAlign: 'right' }}>{o.addressLine}, {o.city} {o.pincode}</span></div> : null}
                <div><span>Payment</span><span>{o.payMode === 'COD' ? 'At collection' : 'Online'} · {o.paymentStatus === 'PAID' ? 'Paid' : o.paymentStatus === 'UNPAID' ? 'Due at collection' : o.paymentStatus === 'PENDING' ? 'Pending' : o.paymentStatus === 'REFUNDED' ? 'Refunded' : 'Not paid'}</span></div>
              </div>
            </div>
            <div className="panel">
              <h2 style={{ marginBottom: 12 }}>Bill</h2>
              <div className="sum">
                <div><span>Cart MRP</span><span>{inr(o.mrpTotal)}</span></div>
                <div className="ok"><span>Discount</span><span>−{inr(o.mrpTotal - o.priceTotal)}</span></div>
                {o.couponDiscount ? <div className="ok"><span>Coupon {o.couponCode}</span><span>−{inr(o.couponDiscount)}</span></div> : null}
                {o.homeCollection ? <div><span>Home collection</span><span>{o.collectionFee ? inr(o.collectionFee) : 'Free'}</span></div> : null}
                {o.hardCopyFee ? <div><span>Hard copy of reports</span><span>{inr(o.hardCopyFee)}</span></div> : null}
                <div className="tot"><span>Total</span><span>{inr(o.total)}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

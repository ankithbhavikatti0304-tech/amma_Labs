'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cart } from '@/lib/client/cart';
import { openSheet, toast } from '@/lib/client/ui';
import { useApp, useCartDetail } from '@/components/providers';
import { TestArt } from '@/components/character/Character';
import { WhatsAppLink, CallButton } from '@/components/home/HomeParts';
import { Icon } from '@/components/Icon';
import { discountPercent } from '@/lib/pricing';
import { inr } from '@/lib/money';
import { tatRange } from '@/lib/catalogue';

function Crumbs() {
  return <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>›</span><span>Cart</span></nav>;
}

export function CartView() {
  const router = useRouter();
  const { settings, coupons, user, city } = useApp();
  const { items, coupon, hard, bill } = useCartDetail();

  if (!items.length) {
    return (
      <div className="wrap">
        <Crumbs />
        <div className="empty" style={{ marginTop: 20 }}>
          <h2 style={{ marginBottom: 6 }}>Your cart is empty</h2>
          <p>Add a test or a package and it will show up here.</p>
          <Link className="btn" href="/category/full">Browse packages</Link>
        </div>
      </div>
    );
  }

  const continueToCheckout = () => (user ? router.push('/checkout') : openSheet({ kind: 'login', next: '/checkout' }));

  return (
    <div className="wrap">
      <Crumbs />
      <div className="two">
        <div className="stack">
          <div className="panel">
            <div className="sec-head" style={{ marginBottom: 6 }}>
              <h2 style={{ fontSize: 20 }}>{items.length} test{items.length > 1 ? 's' : ''} added</h2>
              <Link className="link" href="/category/full">+ Add more tests</Link>
            </div>
            <p className="muted" style={{ margin: '0 0 6px', fontSize: 13.5 }}>Lab: Amma Labs, {city}</p>
            {items.map((t) => {
              const d = discountPercent(t);
              return (
                <div className="citem" key={t.id}>
                  <TestArt t={t} size="sm" />
                  <div className="grow">
                    <b>{t.name}</b>
                    <div className="prices"><span>{inr(t.price)}</span>{d ? <><s>{inr(t.mrp)}</s><span className="off">{d}% off</span></> : null}</div>
                    <span className="muted" style={{ fontSize: 12.5 }}>Report within {tatRange(t)} hours{t.fasting ? ' · 10–12 hr fasting' : ''}{t.centreVisit ? ' · centre visit' : ''}</span>
                  </div>
                  <button type="button" className="rm" onClick={() => { cart.remove(t.id); toast('Removed from cart'); }} aria-label={`Remove ${t.name}`}>Remove</button>
                </div>
              );
            })}
          </div>
          <div className="panel">
            <h2 style={{ fontSize: 18, marginBottom: 12 }}>Prefer to book by message or call?</h2>
            <div className="bar">
              <WhatsAppLink className="btn ghost">Send this cart on WhatsApp</WhatsAppLink>
              <CallButton className="btn ghost"><Icon name="phone" size={18} /> Call {settings.phone}</CallButton>
            </div>
          </div>
        </div>

        <div className="stack">
          {coupons.length ? (
            <div className="panel">
              <h2 style={{ fontSize: 18, marginBottom: 12 }}>Coupons</h2>
              <div className="coupons">
                {coupons.map((c) => (
                  <div className="coupon" key={c.code}>
                    <div><code>{c.code}</code><div className="muted" style={{ fontSize: 12.5 }}>{c.description}</div></div>
                    {coupon?.code === c.code
                      ? <button type="button" className="link" onClick={() => { cart.setCoupon(null); toast('Coupon removed'); }}>Remove</button>
                      : <button type="button" className="link" onClick={() => { cart.setCoupon(c.code); toast(`${c.code} applied`); }}>Apply</button>}
                  </div>
                ))}
              </div>
              {coupon && !bill.couponDiscount ? <p className="muted" style={{ fontSize: 12.5, margin: '10px 0 0' }}>{coupon.code} needs a basket of {inr(coupon.minOrder)} or more.</p> : null}
            </div>
          ) : null}
          <div className="panel">
            <h2 style={{ fontSize: 18, marginBottom: 12 }}>Bill summary</h2>
            <div className="sum">
              <div><span>Cart MRP</span><span>{inr(bill.mrpTotal)}</span></div>
              <div className="ok"><span>Discount</span><span>−{inr(bill.discount)}</span></div>
              {bill.couponDiscount ? <div className="ok"><span>Coupon {coupon?.code}</span><span>−{inr(bill.couponDiscount)}</span></div> : null}
              {bill.homeCollection ? <div><span>Home collection</span><span>{bill.collectionFee ? inr(bill.collectionFee) : 'Free'}</span></div> : null}
              {bill.hardCopyFee ? <div><span>Hard copy of reports</span><span>{inr(bill.hardCopyFee)}</span></div> : null}
              <div className="tot"><span>To be paid</span><span>{inr(bill.total)}</span></div>
            </div>
            {bill.awayFromFreeCollection ? <p className="muted" style={{ fontSize: 12.5, margin: '8px 0 0' }}>Add {inr(bill.awayFromFreeCollection)} more for free home collection.</p> : null}
            <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '16px 0' }} />
            <label className="check">
              <input type="checkbox" checked={hard} onChange={(e) => cart.setHard(e.target.checked)} />
              <span><b>Hard copy of reports</b><br /><span className="muted" style={{ fontSize: 13 }}>Printed report delivered in 3–4 working days. {inr(settings.hardCopyFee)} per order.</span></span>
            </label>
            <button type="button" className="btn block" style={{ marginTop: 18 }} onClick={continueToCheckout}>Continue</button>
          </div>
        </div>
      </div>
    </div>
  );
}

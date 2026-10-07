'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cart } from '@/lib/client/cart';
import { toast } from '@/lib/client/ui';
import { ApiFailure, apiGet, apiPost } from '@/lib/client/api';
import { useApp, useCartDetail } from '@/components/providers';
import { formatPhone, isValidPincode } from '@/lib/phone';
import { dayMonth, weekdayShort } from '@/lib/ist';
import { inr } from '@/lib/money';
import { SERVICEABLE_PINCODE_PREFIXES } from '@/config/lab';
import type { SlotDay } from '@/server/slots';
import type { SavedDetails } from '@/server/account';
import type { OrderDTO } from '@/lib/orders';

type Gender = 'MALE' | 'FEMALE' | 'OTHER';
const GENDERS: [Gender, string][] = [['MALE', 'Male'], ['FEMALE', 'Female'], ['OTHER', 'Other']];

export function CheckoutForm({ days: initialDays, saved }: { days: SlotDay[]; saved: SavedDetails }) {
  const router = useRouter();
  const { user, city } = useApp();
  const { items, coupon, hard, bill } = useCartDetail();
  const [days, setDays] = useState(initialDays);
  const self = saved.patients[0];
  const [name, setName] = useState(self?.name ?? user?.name ?? '');
  const [age, setAge] = useState(self ? String(self.age) : '');
  const [gender, setGender] = useState<Gender | ''>(self?.gender ?? '');
  const [addr, setAddr] = useState(saved.addresses[0]?.line ?? '');
  const [pin, setPin] = useState(saved.addresses[0]?.pincode ?? '');
  const [dateIx, setDateIx] = useState(0);
  const [slotId, setSlotId] = useState('');
  const [pay, setPay] = useState<'COD' | 'ONLINE'>('COD');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState('');
  const [busy, setBusy] = useState(false);
  // One key per checkout screen. A retry after a dropped connection reuses it, so it can never double-book.
  const key = useRef('');
  useEffect(() => { key.current = crypto.randomUUID(); }, []);

  const fasting = items.some((t) => t.fasting || t.morningSample);
  const day = days[dateIx];
  const hasCentre = items.some((t) => t.centreVisit);
  const step = (n: number) => (bill.homeCollection ? n : n - 1);

  // If the chosen slot becomes unavailable (fasting rule or full), clear it.
  const chosen = day?.slots.find((s) => s.id === slotId);
  useEffect(() => {
    if (slotId && (!chosen || !chosen.available || (fasting && !chosen.morning))) setSlotId('');
  }, [slotId, chosen, fasting]);

  const total = useMemo(() => bill.total, [bill.total]);

  if (!items.length) {
    return (
      <div className="wrap">
        <div className="empty" style={{ marginTop: 28 }}>
          <h2>Your cart is empty</h2>
          <p>Add a test or a package to check out.</p>
          <Link className="btn" href="/category/full">Browse packages</Link>
        </div>
      </div>
    );
  }

  async function refreshSlots() {
    try { setDays((await apiGet<{ days: SlotDay[] }>('/api/slots')).days); } catch { /* keep what we have */ }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = 'Enter the patient name.';
    const ageN = Number(age);
    if (age.trim() === '' || !Number.isInteger(ageN) || ageN < 0 || ageN > 120) next.age = 'Enter age in years.';
    if (!gender) next.gender = 'Select gender.';
    if (bill.homeCollection) {
      if (addr.trim().length < 8) next.addr = 'Enter the full address for sample pickup.';
      if (!isValidPincode(pin) || !SERVICEABLE_PINCODE_PREFIXES.some((p) => pin.startsWith(p))) next.pin = 'Enter a 6-digit Karnataka pincode (starts with 5).';
    }
    if (!slotId) next.slot = 'Pick a time slot.';
    setErrs(next);
    setFormErr('');
    if (Object.keys(next).length) {
      document.querySelector('.err:not(:empty)')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    setBusy(true);
    try {
      const { order } = await apiPost<{ order: OrderDTO }>(
        '/api/orders',
        {
          items: items.map((t) => t.id),
          coupon: coupon?.code ?? null,
          hardCopy: hard,
          patient: { name: name.trim(), age: ageN, gender },
          address: bill.homeCollection ? { line: addr.trim(), pincode: pin } : null,
          city,
          slot: { date: day!.date, slotId },
          payMode: pay,
          expectedTotal: total,
        },
        { 'Idempotency-Key': key.current },
      );
      cart.clear();
      router.push(order.status === 'PENDING_PAYMENT' ? `/orders/${order.code}/pay` : `/orders/${order.code}/confirmed`);
    } catch (err) {
      if (err instanceof ApiFailure) {
        if (err.fields) setErrs({ ...(err.fields.addr ? { addr: err.fields.addr } : {}), ...(err.fields.pin ? { pin: err.fields.pin } : {}) });
        if (err.code === 'slot_full') { setSlotId(''); void refreshSlots(); }
        if (err.code === 'unauthenticated') { router.push('/login?next=/checkout'); return; }
        if (err.code === 'price_changed') { router.refresh(); }
        setFormErr(err.message);
      } else setFormErr('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>›</span><Link href="/cart">Cart</Link><span>›</span><span>Checkout</span></nav>
      <form className="two" onSubmit={submit} noValidate>
        <div className="stack">
          <div className="panel">
            <div className="step-h"><span>1</span><h2>Patient</h2></div>
            {saved.patients.length > 1 ? (
              <div className="bar" style={{ marginBottom: 12 }} aria-label="Saved patients">
                {saved.patients.map((p) => (
                  <button key={p.id} type="button" className="chip" aria-pressed={name === p.name && age === String(p.age) && gender === p.gender} onClick={() => { setName(p.name); setAge(String(p.age)); setGender(p.gender); }}>{p.name}</button>
                ))}
              </div>
            ) : null}
            <div className="row2">
              <div className="field"><label htmlFor="pName">Full name</label><input id="pName" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} /><span className="err" role="alert">{errs.name}</span></div>
              <div className="field"><label htmlFor="pPhone">Mobile</label><input id="pPhone" value={user ? `+91 ${formatPhone(user.phone)}` : ''} disabled /></div>
              <div className="field"><label htmlFor="pAge">Age <span className="muted" style={{ fontWeight: 500 }}>(years)</span></label><input id="pAge" inputMode="numeric" maxLength={3} value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, ''))} /><span className="err" role="alert">{errs.age}</span></div>
              <div className="field"><label htmlFor="pGender">Gender</label>
                <select id="pGender" value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
                  <option value="">Select</option>
                  {GENDERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select><span className="err" role="alert">{errs.gender}</span></div>
            </div>
          </div>

          {bill.homeCollection ? (
            <div className="panel">
              <div className="step-h"><span>2</span><h2>Sample collection address</h2></div>
              <div className="stack" style={{ gap: 12 }}>
                {saved.addresses.length > 1 ? (
                  <div className="bar" aria-label="Saved addresses">
                    {saved.addresses.map((a) => <button key={a.id} type="button" className="chip" aria-pressed={addr === a.line && pin === a.pincode} onClick={() => { setAddr(a.line); setPin(a.pincode); }}>{a.line.slice(0, 22)}{a.line.length > 22 ? '…' : ''}</button>)}
                  </div>
                ) : null}
                <div className="field"><label htmlFor="pAddr">House, street, area</label><textarea id="pAddr" value={addr} onChange={(e) => setAddr(e.target.value)} autoComplete="street-address" maxLength={200} /><span className="err" role="alert">{errs.addr}</span></div>
                <div className="row2">
                  <div className="field"><label htmlFor="pPin">Pincode</label><input id="pPin" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} autoComplete="postal-code" /><span className="err" role="alert">{errs.pin}</span></div>
                  <div className="field"><label htmlFor="pCity">City</label><input id="pCity" value={city} disabled /></div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="panel">
            <div className="step-h"><span>{step(3)}</span><h2>{bill.homeCollection ? 'Collection slot' : 'Visit slot'}</h2></div>
            {fasting ? <div className="note" style={{ marginBottom: 12 }}>Your cart has tests that need 10–12 hours of fasting or a morning sample. Only morning slots are open. Water is fine.</div> : null}
            <div className="slots" style={{ marginBottom: 12 }} role="group" aria-label="Date">
              {days.map((d, i) => (
                <button key={d.date} type="button" className="slot" aria-pressed={dateIx === i} onClick={() => setDateIx(i)}><span>{weekdayShort(d.date)}</span><b>{dayMonth(d.date)}</b></button>
              ))}
            </div>
            <div className="slots" role="group" aria-label="Time">
              {day?.slots.map((s) => {
                const off = !s.available || (fasting && !s.morning);
                return <button key={s.id} type="button" className="slot" aria-pressed={slotId === s.id} disabled={off} onClick={() => setSlotId(s.id)}>{s.label}{!s.available ? <span> · full</span> : null}</button>;
              })}
            </div>
            <span className="err" role="alert" style={{ display: 'block', marginTop: 8 }}>{errs.slot}</span>
            {hasCentre ? <div className="note info" style={{ marginTop: 12 }}>X-rays, scans and ECG are done at the centre. We&apos;ll send the address with your booking.</div> : null}
          </div>
        </div>

        <div className="stack">
          <div className="panel">
            <div className="step-h"><span>{step(4)}</span><h2>Payment</h2></div>
            <div className="stack" style={{ gap: 10 }}>
              <label className="check"><input type="radio" name="pay" checked={pay === 'COD'} onChange={() => setPay('COD')} /><span><b>Pay at collection</b><br /><span className="muted" style={{ fontSize: 13 }}>Cash or UPI to our phlebotomist</span></span></label>
              <label className="check"><input type="radio" name="pay" checked={pay === 'ONLINE'} onChange={() => setPay('ONLINE')} /><span><b>Pay online now</b><br /><span className="muted" style={{ fontSize: 13 }}>UPI, card or netbanking</span></span></label>
            </div>
            <div className="sum" style={{ marginTop: 18 }}>
              {items.map((t) => <div key={t.id}><span style={{ minWidth: 0 }}>{t.name}</span><span>{inr(t.price)}</span></div>)}
              {bill.couponDiscount ? <div className="ok"><span>Coupon {coupon?.code}</span><span>−{inr(bill.couponDiscount)}</span></div> : null}
              {bill.homeCollection ? <div><span>Home collection</span><span>{bill.collectionFee ? inr(bill.collectionFee) : 'Free'}</span></div> : null}
              {bill.hardCopyFee ? <div><span>Hard copy</span><span>{inr(bill.hardCopyFee)}</span></div> : null}
              <div className="tot"><span>To be paid</span><span>{inr(total)}</span></div>
            </div>
            {formErr ? <div className="note" role="alert" style={{ marginTop: 14 }}>{formErr}{' '}{formErr.includes('Prices have changed') ? <Link className="link" href="/cart">Review cart</Link> : null}</div> : null}
            <button className="btn block" style={{ marginTop: 18 }} type="submit" disabled={busy}>{busy ? 'Placing order…' : `Place order · ${inr(total)}`}</button>
            <p className="muted" style={{ fontSize: 12.5, margin: '10px 0 0', textAlign: 'center' }}>You can cancel free of charge until the sample is collected.</p>
          </div>
        </div>
      </form>
    </div>
  );
}

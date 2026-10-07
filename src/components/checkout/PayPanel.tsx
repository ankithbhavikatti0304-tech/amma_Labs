'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiFailure, apiPost } from '@/lib/client/api';
import { inr } from '@/lib/money';
import type { PaymentInit } from '@/server/payments/service';

interface RazorpayResponse { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }
type RazorpayCtor = new (o: Record<string, unknown>) => { open(): void; on(e: string, cb: () => void): void };

function loadRazorpay(): Promise<RazorpayCtor> {
  const w = window as unknown as { Razorpay?: RazorpayCtor };
  if (w.Razorpay) return Promise.resolve(w.Razorpay);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error('missing')));
    s.onerror = () => reject(new Error('blocked'));
    document.head.appendChild(s);
  });
}

const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

/** Pay for an online order. The amount shown is the order total; the gateway order is created on the server. */
export function PayPanel({ code, total, expiresAt, phone }: { code: string; total: number; expiresAt: string; phone: string }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [test, setTest] = useState<PaymentInit | null>(null);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const left = new Date(expiresAt).getTime() - now;

  async function verify(r: { providerOrderId: string; paymentId: string; signature: string }) {
    try {
      await apiPost(`/api/orders/${code}/payment/verify`, r);
      router.push(`/orders/${code}/confirmed`);
    } catch (e) {
      setErr(e instanceof ApiFailure ? e.message : 'Could not confirm the payment.');
      setBusy(false);
    }
  }

  async function pay() {
    setBusy(true); setErr('');
    try {
      const init = await apiPost<PaymentInit>(`/api/orders/${code}/payment`);
      if (init.provider === 'mock') { setTest(init); setBusy(false); return; }
      const Razorpay = await loadRazorpay();
      const rz = new Razorpay({
        key: init.keyId, amount: init.amount, currency: init.currency, order_id: init.providerOrderId, name: 'Amma Labs', description: `Order ${code}`,
        prefill: { contact: `+91${phone}` }, theme: { color: '#3368A0' },
        handler: (r: RazorpayResponse) => void verify({ providerOrderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature }),
        modal: { ondismiss: () => setBusy(false) },
      });
      rz.on('payment.failed', () => { setErr('The payment did not go through. You can try again.'); setBusy(false); });
      rz.open();
    } catch (e) {
      setErr(e instanceof ApiFailure ? e.message : "Couldn't open the payment window. Check your connection and try again.");
      setBusy(false);
    }
  }

  if (left <= 0) {
    return <div className="stack" style={{ gap: 12 }}><div className="note">Your slot hold has run out. Nothing was charged.</div><Link className="btn" href="/cart">Book again</Link></div>;
  }
  return (
    <div className="stack" style={{ gap: 14 }}>
      <p className="muted" style={{ margin: 0 }}>Your slot is held for <b className="mono">{mmss(left)}</b>. If it runs out, nothing is charged and you can book again.</p>
      {err ? <div className="note" role="alert">{err}</div> : null}
      {test ? (
        <div className="stack" style={{ gap: 10 }}>
          <div className="demo">Test payment: no money moves. This stands in for the payment window until the gateway keys are added.</div>
          <button type="button" className="btn block" disabled={busy} onClick={() => { setBusy(true); void verify({ providerOrderId: test.providerOrderId, paymentId: `pay_${test.providerOrderId.slice(5)}`, signature: test.devSignature! }); }}>Pay {inr(total)} (test)</button>
          <button type="button" className="btn ghost block" onClick={() => { setTest(null); setErr('The payment did not go through. You can try again.'); }}>Simulate a failed payment</button>
        </div>
      ) : (
        <button type="button" className="btn block" disabled={busy} onClick={pay}>{busy ? 'Opening payment…' : `Pay ${inr(total)}`}</button>
      )}
      <p className="muted" style={{ margin: 0, fontSize: 12.5, textAlign: 'center' }}>UPI, cards and netbanking. We never see your card or UPI PIN.</p>
    </div>
  );
}

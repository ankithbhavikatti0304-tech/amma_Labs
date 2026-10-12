'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiFailure, apiPost } from '@/lib/client/api';
import { toast } from '@/lib/client/ui';
import { inr } from '@/lib/money';
import { formatPhone } from '@/lib/phone';
import type { PickupDTO } from '@/server/staff';

/** Run a staff action, show the server's message on failure, refresh the page on success. */
export function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function run<T>(fn: () => Promise<T>, ok?: string | ((r: T) => string)) {
    setBusy(true);
    setErr('');
    try {
      const r = await fn();
      if (ok) toast(typeof ok === 'function' ? ok(r) : ok);
      router.refresh();
      return r;
    } catch (e) {
      setErr(e instanceof ApiFailure ? e.message : 'Something went wrong.');
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  return { run, busy, err, setErr };
}

export function PickupCard({ p }: { p: PickupDTO }) {
  const { run, busy, err } = useAction();
  const [barcode, setBarcode] = useState('');
  const [paid, setPaid] = useState(p.amountDue > 0);
  const done = p.status !== 'BOOKED';
  return (
    <div className="panel" style={{ display: 'grid', gap: 10 }}>
      <div className="ohead">
        <div>
          <b>{p.patientName}, {p.patientAge} y</b>
          <div className="muted" style={{ fontSize: 13 }}><span className="mono">{p.code}</span> · {p.slotLabel}{p.assignedTo ? ` · ${p.assignedTo}` : ' · unassigned'}</div>
        </div>
        <a className="btn ghost sm" href={`tel:+91${p.phone}`}>Call +91 {formatPhone(p.phone)}</a>
      </div>
      {p.address ? <p style={{ margin: 0, fontWeight: 600 }}>{p.address}</p> : null}
      <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>{p.tests.join(', ')}</p>
      {done ? <div className="note info">Sample collected.</div> : (
        <form className="bar" onSubmit={(e) => { e.preventDefault(); void run(() => apiPost(`/api/staff/orders/${p.code}/collect`, { barcode: barcode || undefined, paymentCollected: p.amountDue > 0 ? paid : undefined }), 'Marked as collected'); }}>
          <div className="field" style={{ flex: '1 1 180px' }}><label htmlFor={`bc-${p.code}`} className="sr">Tube barcode</label><input id={`bc-${p.code}`} style={{ height: 42 }} placeholder="Tube barcode (optional)" value={barcode} onChange={(e) => setBarcode(e.target.value)} maxLength={40} autoComplete="off" /></div>
          {p.amountDue > 0 ? <label className="check" style={{ padding: '8px 12px' }}><input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /><span>Collected {inr(p.amountDue)}</span></label> : null}
          <button className="btn sm" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Mark collected'}</button>
        </form>
      )}
      {err ? <span className="err" role="alert">{err}</span> : null}
    </div>
  );
}

/** An admin action that needs a written reason: reopen a report, cancel an order. */
export function ReasonAction({ endpoint, label, button, done }: { endpoint: string; label: string; button: string; done: string }) {
  const { run, busy, err } = useAction();
  const [reason, setReason] = useState('');
  return (
    <form className="stack" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (window.confirm(`${button}? This is recorded in the audit log.`)) void run(() => apiPost(endpoint, { reason }), done); }}>
      <div className="field"><label htmlFor={`r-${button}`}>{label}</label><input id={`r-${button}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} /></div>
      {err ? <span className="err" role="alert">{err}</span> : null}
      <button className="btn ghost sm" type="submit" disabled={busy || reason.trim().length < 5}>{button}</button>
    </form>
  );
}

export function AssignForm({ code, current, staff }: { code: string; current: string | null; staff: { id: string; name: string }[] }) {
  const { run, busy, err } = useAction();
  const [v, setV] = useState(current ?? '');
  return (
    <form className="bar" onSubmit={(e) => { e.preventDefault(); void run(() => apiPost(`/api/staff/orders/${code}/assign`, { phlebotomistId: v || null }), 'Assignment saved'); }}>
      <div className="field" style={{ flex: '1 1 180px' }}><label htmlFor="assign" className="sr">Assign to</label>
        <select id="assign" style={{ height: 42 }} value={v} onChange={(e) => setV(e.target.value)}>
          <option value="">Unassigned</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select></div>
      <button className="btn ghost sm" type="submit" disabled={busy}>Save</button>
      {err ? <span className="err" role="alert">{err}</span> : null}
    </form>
  );
}

export function ReleaseButton({ code, ready, missing }: { code: string; ready: boolean; missing: number }) {
  const { run, busy, err } = useAction();
  return (
    <div className="stack" style={{ gap: 8 }}>
      {!ready ? <div className="note">{missing} result{missing === 1 ? '' : 's'} still to be entered before this can be released.</div> : null}
      {err ? <span className="err" role="alert">{err}</span> : null}
      <button className="btn" type="button" disabled={!ready || busy} onClick={() => { if (window.confirm('Verify these results and release the report to the patient? You cannot edit it after this.')) void run(() => apiPost(`/api/staff/orders/${code}/release`), 'Report released'); }}>
        {busy ? 'Releasing…' : 'Verify and release report'}
      </button>
    </div>
  );
}


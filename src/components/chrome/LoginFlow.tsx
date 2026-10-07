'use client';
import { useEffect, useRef, useState } from 'react';
import { ApiFailure, apiPost } from '@/lib/client/api';
import { isValidPhone, normalizePhone, formatPhone } from '@/lib/phone';
import { SheetHead } from './Modal';
import type { SessionUser } from '@/server/auth/session';

type Step = 'details' | 'otp';

/** Phone + OTP login. Used in the login sheet and on /login. */
export function LoginFlow({ onSuccess, onClose }: { onSuccess: (user: SessionUser) => void; onClose?: () => void }) {
  const [step, setStep] = useState<Step>('details');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [shake, setShake] = useState(false);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const verifying = useRef(false);

  // resend countdown
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const ph = normalizePhone(phone);
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = 'Enter your name as it should appear on the report.';
    if (!isValidPhone(ph)) next.phone = 'Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9.';
    if (!consent) next.consent = 'Please agree to continue.';
    setErrs(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const r = await apiPost<{ resendAfter: number; devCode?: string }>('/api/auth/otp/send', { phone: ph, name: name.trim(), consent });
      setDevCode(r.devCode ?? null);
      setLeft(r.resendAfter);
      setDigits(Array(6).fill(''));
      setStep('otp');
      setTimeout(() => boxes.current[0]?.focus(), 30);
    } catch (err) {
      if (err instanceof ApiFailure) {
        if (err.fields) setErrs(err.fields);
        else setErrs({ form: err.message });
        if (err.code === 'rate_limited' && err.retryAfter && err.retryAfter <= 60) setLeft(err.retryAfter);
      }
    } finally {
      setBusy(false);
    }
  }

  async function verify(code: string) {
    if (verifying.current) return;
    verifying.current = true;
    setBusy(true);
    try {
      const r = await apiPost<{ user: SessionUser }>('/api/auth/otp/verify', { phone: normalizePhone(phone), code });
      onSuccess(r.user);
    } catch (err) {
      setErrs({ otp: err instanceof ApiFailure ? err.message : 'Something went wrong. Please try again.' });
      setShake(true);
      setTimeout(() => setShake(false), 350);
      setDigits(Array(6).fill(''));
      boxes.current[0]?.focus();
    } finally {
      verifying.current = false;
      setBusy(false);
    }
  }

  function setDigit(i: number, raw: string) {
    const d = raw.replace(/\D/g, '').slice(-1);
    const nextDigits = digits.slice();
    nextDigits[i] = d;
    setDigits(nextDigits);
    setErrs({});
    if (d && i < 5) boxes.current[i + 1]?.focus();
    if (nextDigits.every(Boolean)) void verify(nextDigits.join(''));
  }

  function onPaste(e: React.ClipboardEvent) {
    const d = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!d) return;
    e.preventDefault();
    const nextDigits = Array.from({ length: 6 }, (_, i) => d[i] ?? '');
    setDigits(nextDigits);
    boxes.current[Math.min(d.length, 5)]?.focus();
    if (d.length === 6) void verify(d);
  }

  const ph = normalizePhone(phone);

  if (step === 'details') {
    return (
      <>
        {onClose ? <SheetHead title="Log in" sub="Use your mobile number. We will send a 6-digit code." onClose={onClose} /> : <p className="muted" style={{ marginBottom: 14 }}>Use your mobile number. We will send a 6-digit code.</p>}
        <form className="stack" style={{ gap: 14 }} onSubmit={send} noValidate>
          <div className="field">
            <label htmlFor="lName">Your name</label>
            <input id="lName" autoComplete="name" placeholder="e.g. Lakshmi Rao" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-invalid={!!errs.name} aria-describedby="lNameE" />
            <span className="err" id="lNameE" role="alert">{errs.name}</span>
          </div>
          <div className="field">
            <label htmlFor="lPhone">Mobile number</label>
            <div className="phone-in">
              <span>+91</span>
              <input id="lPhone" inputMode="numeric" autoComplete="tel-national" maxLength={14} placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={!!errs.phone} aria-describedby="lPhoneE" />
            </div>
            <span className="err" id="lPhoneE" role="alert">{errs.phone}</span>
          </div>
          <label className="check" style={{ padding: '10px 12px' }}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-describedby="lConsentE" />
            <span style={{ fontSize: 13 }}>
              I agree to the <a href="/privacy" target="_blank" rel="noopener">privacy notice</a> and to get booking updates by SMS and WhatsApp.
            </span>
          </label>
          <span className="err" id="lConsentE" role="alert">{errs.consent}</span>
          {errs.form ? <div className="note" role="alert">{errs.form}</div> : null}
          <button className="btn block" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send OTP'}</button>
        </form>
      </>
    );
  }

  return (
    <>
      {onClose ? (
        <SheetHead
          title="Enter OTP"
          sub={<>Sent to +91 {formatPhone(ph)} · <button type="button" className="link" onClick={() => { setStep('details'); setErrs({}); }}>Change</button></>}
          onClose={onClose}
        />
      ) : (
        <p className="muted" style={{ marginBottom: 14 }}>Sent to +91 {formatPhone(ph)} · <button type="button" className="link" onClick={() => setStep('details')}>Change</button></p>
      )}
      <form className="stack" style={{ gap: 14 }} onSubmit={(e) => { e.preventDefault(); if (digits.every(Boolean)) void verify(digits.join('')); else setErrs({ otp: 'Enter all 6 digits.' }); }} noValidate>
        <div className={`otp${shake ? ' shake' : ''}`} onPaste={onPaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { boxes.current[i] = el; }}
              inputMode="numeric"
              maxLength={1}
              value={d}
              aria-label={`Digit ${i + 1}`}
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Backspace' && !d && i > 0) boxes.current[i - 1]?.focus(); }}
            />
          ))}
        </div>
        <span className="err" role="alert">{errs.otp}</span>
        {devCode ? <div className="demo">Demo mode: SMS is not connected yet. Your code is <b>{devCode}</b></div> : null}
        <button className="btn block" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Verify and continue'}</button>
        <p className="muted" style={{ margin: 0, fontSize: 13.5, textAlign: 'center' }}>
          {left > 0 ? `Resend code in 0:${String(left).padStart(2, '0')}` : <>Didn&apos;t get it? <button type="button" className="link" onClick={() => void send()}>Resend OTP</button></>}
        </p>
      </form>
    </>
  );
}

'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Modal, SheetHead } from './Modal';
import { LoginFlow } from './LoginFlow';
import { closeSheet, openSheet, toast, useSheet, type SheetState } from '@/lib/client/ui';
import { useApp } from '@/components/providers';
import { cart, useInCart } from '@/lib/client/cart';
import { TestArt } from '@/components/character/Character';
import { Icon } from '@/components/Icon';
import { discountPercent } from '@/lib/pricing';
import { inr } from '@/lib/money';
import { tatRange } from '@/lib/catalogue';
import { ApiFailure, apiPost, apiUpload } from '@/lib/client/api';
import { isValidPhone, normalizePhone } from '@/lib/phone';

/** Hosts whichever sheet is open. Keeps the last one mounted during the close animation. */
export function SheetHost() {
  const sheet = useSheet();
  const last = useRef<SheetState>(null);
  if (sheet) last.current = sheet;
  const s = sheet ?? last.current;
  const label = s?.kind === 'login' ? 'Log in' : s?.kind === 'call' ? 'Book by phone' : s?.kind === 'upload' ? 'Upload prescription' : 'Test details';
  return (
    <Modal open={!!sheet} onClose={closeSheet} label={label}>
      {s?.kind === 'login' ? <LoginSheet next={s.next} afterLogin={s.afterLogin} /> : null}
      {s?.kind === 'call' ? <CallSheet /> : null}
      {s?.kind === 'detail' ? <DetailSheet id={s.id} /> : null}
      {s?.kind === 'upload' ? <UploadSheet /> : null}
    </Modal>
  );
}

function LoginSheet({ next, afterLogin }: { next?: string; afterLogin?: 'upload' }) {
  const router = useRouter();
  return (
    <LoginFlow
      onClose={closeSheet}
      onSuccess={(user) => {
        closeSheet();
        toast(`Welcome, ${user.name.split(/\s+/)[0]}`);
        router.refresh();
        if (next) router.push(next);
        else if (afterLogin === 'upload') setTimeout(() => openSheet({ kind: 'upload' }), 250);
      }}
    />
  );
}

function DetailSheet({ id }: { id: string }) {
  const { byId } = useApp();
  const t = byId.get(id);
  const inCart = useInCart(id);
  if (!t) return <SheetHead title="Not available" sub="This test is no longer offered." onClose={closeSheet} />;
  const d = discountPercent(t);
  return (
    <>
      <SheetHead title={t.name} sub={t.isPackage ? 'Health checkup package' : t.centreVisit ? 'Done at the centre' : 'Single test'} onClose={closeSheet} />
      <div className="detail-top">
        <TestArt t={t} size="lg" />
        <div className="prices"><span className="price">{inr(t.price)}</span>{d ? <><s>{inr(t.mrp)}</s><span className="off">{d}% off</span></> : null}</div>
      </div>
      <div className="facts">
        <div><span>Report</span>{tatRange(t)} hrs</div>
        <div><span>Sample</span>{t.centreVisit ? 'At centre' : 'Blood'}</div>
        <div><span>Preparation</span>{t.fasting ? '10–12 hr fasting' : t.morningSample ? 'Before 9 am' : 'None'}</div>
      </div>
      {t.includes.length ? (
        <>
          <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Includes {t.parameterCount ? `${t.parameterCount} tests` : ''}</p>
          <ul className="detail-list">{t.includes.map((x) => <li key={x}>{x}</li>)}</ul>
        </>
      ) : null}
      <button type="button" className="btn block" style={{ marginTop: 18 }} onClick={() => { const now = cart.toggle(id); toast(now ? 'Added to cart' : 'Removed from cart'); closeSheet(); }}>
        {inCart ? 'Remove from cart' : 'Add to cart'}
      </button>
      <p style={{ margin: '12px 0 0', textAlign: 'center' }}><Link className="link" href={`/test/${t.slug}`} onClick={closeSheet}>Full details →</Link></p>
    </>
  );
}

function CallSheet() {
  const { settings, user } = useApp();
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const tel = settings.phone.replace(/\s/g, '');

  async function copy() {
    try { await navigator.clipboard.writeText(settings.phone); toast('Number copied'); } catch { toast('Select the number to copy it'); }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ph = normalizePhone(phone);
    if (!isValidPhone(ph)) { setErr('Enter a 10-digit mobile number.'); return; }
    setBusy(true);
    try {
      await apiPost('/api/callbacks', { phone: ph });
      closeSheet();
      toast('Call back requested. We will call you soon.');
    } catch (error) {
      setErr(error instanceof ApiFailure ? error.message : 'Something went wrong.');
    } finally { setBusy(false); }
  }
  return (
    <>
      <SheetHead title="Book by phone" sub="Our team picks the right tests and books a slot for you." onClose={closeSheet} />
      <div className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div><span className="bignum">{settings.phone}</span><div className="muted" style={{ fontSize: 13 }}>{settings.hours}</div></div>
        <div className="bar">
          <a className="btn" href={`tel:${tel}`}><Icon name="phone" size={18} /> Call</a>
          <button type="button" className="btn ghost" onClick={copy}><Icon name="copy" size={18} /> Copy</button>
        </div>
      </div>
      <p style={{ margin: '18px 0 8px', fontWeight: 600 }}>Or ask us to call you</p>
      <form className="stack" style={{ gap: 10 }} onSubmit={submit} noValidate>
        <label className="phone-in">
          <span>+91</span>
          <input inputMode="numeric" maxLength={14} placeholder="10-digit mobile number" aria-label="Mobile number" value={phone} onChange={(e) => { setPhone(e.target.value); setErr(''); }} style={{ height: 46 }} />
        </label>
        <span className="err" role="alert">{err}</span>
        <button className="btn block" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Request a call back'}</button>
      </form>
    </>
  );
}

const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_BYTES = 5 * 1024 * 1024;

function UploadSheet() {
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState('');
  const [state, setState] = useState<'idle' | 'uploading' | 'done'>('idle');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);

  function pick(f: File | undefined) {
    setErr('');
    if (!f) return;
    if (!OK_TYPES.includes(f.type)) return setErr('Please choose a JPG, PNG or WebP photo, or a PDF.');
    if (f.size > MAX_BYTES) return setErr('That file is over 5 MB. Please choose a smaller one.');
    setFile(f);
  }
  async function upload() {
    if (!file) return;
    setState('uploading');
    try {
      const fd = new FormData();
      fd.set('file', file);
      await apiUpload('/api/prescriptions', fd);
      setState('done');
    } catch (e) {
      setErr(e instanceof ApiFailure ? e.message : 'Upload failed. Please try again.');
      setState('idle');
    }
  }

  if (state === 'done') {
    return (
      <>
        <SheetHead title="Prescription received" onClose={closeSheet} />
        <p>Our team reads the prescription, picks the matching tests and calls you to confirm the price and slot.</p>
        <button type="button" className="btn block" style={{ marginTop: 16 }} onClick={closeSheet}>Done</button>
      </>
    );
  }
  return (
    <>
      <SheetHead title="Upload prescription" sub="A photo or PDF of your doctor's prescription. Only our team can see it." onClose={closeSheet} />
      <input ref={input} id="rxFile" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr" onChange={(e) => pick(e.target.files?.[0])} />
      <label htmlFor="rxFile" className="empty" style={{ cursor: 'pointer', padding: '28px 16px' }}>
        <span className="ic"><Icon name="rx" /></span>
        <b>{file ? file.name : 'Choose a photo or PDF'}</b>
        <span style={{ fontSize: 13 }}>{file ? `${Math.max(1, Math.round(file.size / 1024))} KB · tap to change` : 'JPG, PNG, WebP or PDF, up to 5 MB'}</span>
      </label>
      <span className="err" role="alert" style={{ display: 'block', marginTop: 8 }}>{err}</span>
      <button type="button" className="btn block" style={{ marginTop: 14 }} disabled={!file || state === 'uploading'} onClick={upload}>{state === 'uploading' ? 'Uploading…' : 'Send to Amma Labs'}</button>
    </>
  );
}

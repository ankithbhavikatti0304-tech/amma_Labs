'use client';
import { useEffect, useState } from 'react';
import { apiPost, ApiFailure } from '@/lib/client/api';
import { isValidPhone, normalizePhone } from '@/lib/phone';
import { toast } from '@/lib/client/ui';

export function CallbackForm() {
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ph = normalizePhone(phone);
    if (!isValidPhone(ph)) { toast('Enter a 10-digit mobile number'); return; }
    setBusy(true);
    try {
      await apiPost('/api/callbacks', { phone: ph });
      setPhone('');
      toast('Call back requested. We will call you soon.');
    } catch (err) {
      toast(err instanceof ApiFailure ? err.message : 'Something went wrong');
    } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} noValidate>
      <label className="phone-in">
        <span>+91</span>
        <input inputMode="numeric" maxLength={14} placeholder="Your phone number" aria-label="Phone number for call back" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <button className="btn" type="submit" disabled={busy}>Call me</button>
    </form>
  );
}

/** Light/dark switch. Stored in a cookie so the server renders the right theme with no flash. */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    setDark(t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches);
  }, []);
  return (
    <button
      type="button"
      className="switch"
      aria-pressed={dark}
      onClick={() => {
        const next = dark ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        document.cookie = `al_theme=${next}; path=/; max-age=31536000; samesite=lax`;
        setDark(!dark);
      }}
    >
      Dark mode <i />
    </button>
  );
}

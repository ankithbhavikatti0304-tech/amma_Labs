'use client';
import { useState, useSyncExternalStore } from 'react';
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
const THEME_EVENT = 'al-theme';
const subscribeTheme = (cb: () => void) => {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', cb);
  window.addEventListener(THEME_EVENT, cb);
  return () => { mq.removeEventListener('change', cb); window.removeEventListener(THEME_EVENT, cb); };
};
const isDark = () => { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches; };

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribeTheme, isDark, () => false);
  return (
    <button
      type="button"
      className="switch"
      aria-pressed={dark}
      onClick={() => {
        const next = dark ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        document.cookie = `al_theme=${next}; path=/; max-age=31536000; samesite=lax`;
        window.dispatchEvent(new Event(THEME_EVENT));
      }}
    >
      Dark mode <i />
    </button>
  );
}

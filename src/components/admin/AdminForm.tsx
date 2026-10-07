'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiFailure, apiDelete, apiPatch, apiPost, apiPut } from '@/lib/client/api';
import { toast } from '@/lib/client/ui';

type Opt = { value: string; label: string };
export type FieldDef = { name: string; label: string; hint?: string; half?: boolean } & (
  | { type: 'text' | 'number' | 'date'; required?: boolean; maxLength?: number }
  | { type: 'textarea'; rows?: number }
  | { type: 'checkbox' }
  | { type: 'select'; options: Opt[] }
  | { type: 'checks'; options: Opt[] }
);

type Value = string | boolean | string[];

/**
 * A form built from a list of fields, for the admin screens. Sends JSON, shows the server's
 * field messages, refreshes the page on success. Validation lives on the server; the browser
 * only avoids obvious mistakes.
 */
export function AdminForm({ fields, initial, endpoint, method = 'PATCH', submit = 'Save', done = 'Saved', redirect, compact }: { fields: FieldDef[]; initial: Record<string, unknown>; endpoint: string; method?: 'POST' | 'PATCH' | 'PUT'; submit?: string; done?: string; redirect?: (r: unknown) => string; compact?: boolean }) {
  const router = useRouter();
  const [v, setV] = useState<Record<string, Value>>(() => Object.fromEntries(fields.map((f) => {
    const x = initial[f.name];
    return [f.name, f.type === 'checkbox' ? !!x : f.type === 'checks' ? ((x as string[]) ?? []) : x === null || x === undefined ? '' : f.type === 'date' && typeof x === 'string' ? x.slice(0, 10) : String(x)];
  })));
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (name: string, val: Value) => setV((s) => ({ ...s, [name]: val }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErrs({}); setFormErr('');
    try {
      const call = method === 'POST' ? apiPost : method === 'PUT' ? apiPut : apiPatch;
      const r = await call(endpoint, v);
      toast(done);
      if (redirect) router.push(redirect(r));
      router.refresh();
    } catch (err) {
      if (err instanceof ApiFailure) { setErrs(err.fields ?? {}); setFormErr(err.fields ? '' : err.message); }
      else setFormErr('Something went wrong.');
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={onSubmit} className="stack" style={{ gap: compact ? 8 : 14 }} noValidate>
      <div className={compact ? 'bar' : 'row2'} style={compact ? { alignItems: 'end' } : undefined}>
        {fields.map((f) => {
          const id = `f-${endpoint}-${f.name}`.replace(/[^a-z0-9-]/gi, '_');
          const err = errs[f.name];
          const full = !compact && (f.type === 'textarea' || f.type === 'checks');
          return (
            <div key={f.name} className="field" style={full ? { gridColumn: '1 / -1' } : compact ? { flex: '1 1 120px' } : undefined}>
              {f.type === 'checkbox' ? (
                <label className="check" style={{ padding: '10px 12px' }}><input type="checkbox" checked={v[f.name] as boolean} onChange={(e) => set(f.name, e.target.checked)} /><span><b>{f.label}</b>{f.hint ? <><br /><span className="muted" style={{ fontSize: 12.5 }}>{f.hint}</span></> : null}</span></label>
              ) : (
                <>
                  <label htmlFor={id}>{f.label}</label>
                  {f.type === 'textarea' ? <textarea id={id} rows={f.rows ?? 4} value={v[f.name] as string} onChange={(e) => set(f.name, e.target.value)} />
                    : f.type === 'select' ? <select id={id} value={v[f.name] as string} onChange={(e) => set(f.name, e.target.value)}>{f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
                    : f.type === 'checks' ? (
                      <div className="bar" id={id} role="group" aria-label={f.label}>
                        {f.options.map((o) => { const on = (v[f.name] as string[]).includes(o.value); return <button key={o.value} type="button" className="chip" aria-pressed={on} onClick={() => set(f.name, on ? (v[f.name] as string[]).filter((x) => x !== o.value) : [...(v[f.name] as string[]), o.value])}>{o.label}</button>; })}
                      </div>
                    ) : <input id={id} type={f.type === 'number' ? 'text' : f.type} inputMode={f.type === 'number' ? 'decimal' : undefined} value={v[f.name] as string} onChange={(e) => set(f.name, e.target.value)} maxLength={f.maxLength} autoComplete="off" />}
                  {f.hint ? <span className="muted" style={{ fontSize: 12 }}>{f.hint}</span> : null}
                </>
              )}
              {err ? <span className="err" role="alert">{err}</span> : null}
            </div>
          );
        })}
      </div>
      {formErr ? <div className="note" role="alert">{formErr}</div> : null}
      <div><button className="btn sm" type="submit" disabled={busy}>{busy ? 'Saving…' : submit}</button></div>
    </form>
  );
}

/** A small button for one-click actions such as delete or enable/disable. */
export function ActionButton({ endpoint, method, body, label, done, confirm, ghost = true }: { endpoint: string; method: 'PATCH' | 'DELETE' | 'POST'; body?: unknown; label: string; done: string; confirm?: string; ghost?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" className={`btn sm${ghost ? ' ghost' : ''}`} disabled={busy} onClick={async () => {
      if (confirm && !window.confirm(confirm)) return;
      setBusy(true);
      try {
        await (method === 'DELETE' ? apiDelete(endpoint) : method === 'PATCH' ? apiPatch(endpoint, body) : apiPost(endpoint, body));
        toast(done);
        router.refresh();
      } catch (e) { toast(e instanceof ApiFailure ? e.message : 'Something went wrong.'); } finally { setBusy(false); }
    }}>{label}</button>
  );
}

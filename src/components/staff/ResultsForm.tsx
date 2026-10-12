'use client';
import { useState } from 'react';
import { ApiFailure, apiPut } from '@/lib/client/api';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/client/ui';
import { FLAG_LABEL } from '@/lib/results';
import type { EntryRow } from '@/server/results';

const FLAG_CLASS = { NORMAL: 'n', HIGH: 'h', LOW: 'l', ABNORMAL: 'h' } as const;

/** Result entry. The flag is shown after saving and is set by the server from the patient's range, never typed. */
export function ResultsForm({ code, rows, editable }: { code: string; rows: EntryRow[]; editable: boolean }) {
  const router = useRouter();
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((r) => [r.parameterId, r.value])));
  const [abn, setAbn] = useState<Record<string, boolean>>(() => Object.fromEntries(rows.map((r) => [r.parameterId, r.abnormal])));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setBusy(true);
    setErr('');
    try {
      const entries = rows.filter((r) => (vals[r.parameterId] ?? '').trim() !== (r.value ?? '') || (r.kind === 'TEXT' && abn[r.parameterId] !== r.abnormal)).map((r) => ({ parameterId: r.parameterId, value: vals[r.parameterId] ?? '', abnormal: abn[r.parameterId] }));
      if (!entries.length) { toast('Nothing new to save'); return; }
      const r = await apiPut<{ saved: number }>(`/api/staff/orders/${code}/results`, { entries });
      toast(`Saved ${r.saved} result${r.saved === 1 ? '' : 's'}`);
      router.refresh();
    } catch (e) {
      setErr(e instanceof ApiFailure ? e.message : 'Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  // Group by test, then by section heading.
  const byTest = new Map<string, EntryRow[]>();
  rows.forEach((r) => byTest.set(r.testName, [...(byTest.get(r.testName) ?? []), r]));

  return (
    <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="stack" style={{ gap: 18 }}>
      {[...byTest.entries()].map(([testName, list]) => (
        <div key={testName}>
          <h3 style={{ fontSize: 16, marginBottom: 8 }}>{testName}</h3>
          <div className="tbl" style={{ marginTop: 0 }}>
            <table style={{ minWidth: 560 }}>
              <thead><tr><th>Parameter</th><th>Result</th><th>Unit</th><th>Reference range</th><th>Flag</th></tr></thead>
              <tbody>
                {list.map((r, i) => (
                  <Row key={r.parameterId} r={r} prev={list[i - 1]} value={vals[r.parameterId] ?? ''} abnormal={abn[r.parameterId] ?? false} editable={editable}
                    onChange={(v) => setVals((s) => ({ ...s, [r.parameterId]: v }))} onAbnormal={(b) => setAbn((s) => ({ ...s, [r.parameterId]: b }))} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {err ? <div className="note" role="alert">{err}</div> : null}
      {editable ? <div><button className="btn" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save results'}</button></div> : null}
    </form>
  );
}

function Row({ r, prev, value, abnormal, editable, onChange, onAbnormal }: { r: EntryRow; prev?: EntryRow; value: string; abnormal: boolean; editable: boolean; onChange: (v: string) => void; onAbnormal: (b: boolean) => void }) {
  const id = `res-${r.parameterId}`;
  return (
    <>
      {r.groupName && r.groupName !== prev?.groupName ? <tr className="grp"><td colSpan={5}>{r.groupName}</td></tr> : null}
      <tr>
        <td><label htmlFor={id}>{r.name}</label></td>
        <td style={{ minWidth: 150 }}>
          {!editable ? <b>{value || '—'}</b> : r.kind === 'NUMERIC' ? (
            <input id={id} className="resin" inputMode="decimal" autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} aria-describedby={`${id}-r`} />
          ) : r.kind === 'CHOICE' ? (
            <select id={id} value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}><option value="">Select</option>{r.options.map((o) => <option key={o}>{o}</option>)}</select>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={3} maxLength={2000} style={{ ...inputStyle, height: 'auto', padding: 10 }} />
              <label className="switch" style={{ fontSize: 13 }}><input type="checkbox" checked={abnormal} onChange={(e) => onAbnormal(e.target.checked)} /> Abnormal finding</label>
            </div>
          )}
        </td>
        <td className="muted">{r.unit}</td>
        <td className="muted" id={`${id}-r`}>{r.range ?? '—'}</td>
        <td>{r.flag ? <span className={`flag ${FLAG_CLASS[r.flag]}`}>{FLAG_LABEL[r.flag]}</span> : null}</td>
      </tr>
    </>
  );
}

const inputStyle: React.CSSProperties = { height: 40, width: '100%', border: '1px solid var(--line-2)', borderRadius: 12, padding: '0 10px', background: 'var(--surface)' };


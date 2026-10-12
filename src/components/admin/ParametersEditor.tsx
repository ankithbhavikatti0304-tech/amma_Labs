'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiFailure, apiPut } from '@/lib/client/api';
import { toast } from '@/lib/client/ui';

interface Item { parameterId: string; groupName: string }

/** Choose which parameters a test reports, in what order, under which section heading. */
export function ParametersEditor({ testId, initial, all }: { testId: string; initial: Item[]; all: { id: string; name: string }[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(initial);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const name = (id: string) => all.find((a) => a.id === id)?.name ?? id;
  const available = all.filter((a) => !items.some((i) => i.parameterId === a.id));
  const move = (i: number, d: number) => setItems((s) => { const n = s.slice(); const j = i + d; if (j < 0 || j >= n.length) return s; [n[i], n[j]] = [n[j]!, n[i]!]; return n; });

  async function save() {
    setBusy(true); setErr('');
    try {
      await apiPut(`/api/admin/tests/${testId}/parameters`, { items: items.map((i) => ({ parameterId: i.parameterId, groupName: i.groupName.trim() || null })) });
      toast('Parameters saved');
      router.refresh();
    } catch (e) { setErr(e instanceof ApiFailure ? e.message : 'Something went wrong.'); } finally { setBusy(false); }
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      {items.length ? (
        <div className="tbl" style={{ marginTop: 0 }}>
          <table style={{ minWidth: 480 }}>
            <thead><tr><th>Parameter</th><th>Section heading on report</th><th /></tr></thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.parameterId}>
                  <td>{name(it.parameterId)}</td>
                  <td><input aria-label={`Section for ${name(it.parameterId)}`} value={it.groupName} placeholder="(none)" maxLength={80} onChange={(e) => setItems((s) => s.map((x, j) => (j === i ? { ...x, groupName: e.target.value } : x)))} style={{ height: 36, width: '100%', border: '1px solid var(--line-2)', borderRadius: 10, padding: '0 10px', background: 'var(--surface)' }} /></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button type="button" className="chip" onClick={() => move(i, -1)} aria-label={`Move ${name(it.parameterId)} up`}>↑</button>{' '}
                    <button type="button" className="chip" onClick={() => move(i, 1)} aria-label={`Move ${name(it.parameterId)} down`}>↓</button>{' '}
                    <button type="button" className="rm" onClick={() => setItems((s) => s.filter((_, j) => j !== i))}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="note">No parameters yet, so technicians have nothing to enter and no report can be released for this test.</div>}
      <div className="bar">
        <div className="field" style={{ flex: '1 1 240px' }}><label htmlFor="addp" className="sr">Add a parameter</label>
          <select id="addp" value={pick} onChange={(e) => setPick(e.target.value)}><option value="">Add a parameter…</option>{available.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
        <button type="button" className="btn ghost sm" disabled={!pick} onClick={() => { setItems((s) => [...s, { parameterId: pick, groupName: s[s.length - 1]?.groupName ?? '' }]); setPick(''); }}>Add</button>
      </div>
      {err ? <div className="note" role="alert">{err}</div> : null}
      <div><button type="button" className="btn sm" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save parameters'}</button></div>
    </div>
  );
}

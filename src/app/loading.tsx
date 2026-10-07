/** Shown while a page's server data loads. Cheap, and keeps the layout from jumping. */
export default function Loading() {
  return (
    <div className="wrap" role="status" aria-busy="true">
      <span className="sr">Loading…</span>
      <div style={{ height: 28, width: 180, margin: '28px 0 18px', borderRadius: 999, background: 'var(--sunk)' }} />
      <div className="grid">
        {Array.from({ length: 6 }, (_, i) => <div key={i} style={{ height: 320, borderRadius: 26, background: 'var(--sunk)' }} />)}
      </div>
    </div>
  );
}

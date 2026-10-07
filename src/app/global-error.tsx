'use client';

/** Last-resort fallback if the root layout itself fails. Plain HTML and inline styles on purpose: nothing here can depend on the app. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#F2EFE7', color: '#0F2236', display: 'grid', placeItems: 'center', minHeight: '100vh', margin: 0, padding: 24 }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1>Amma Labs is having a problem</h1>
          <p>Please try again in a minute.</p>
          <button type="button" onClick={reset} style={{ height: 48, padding: '0 22px', borderRadius: 999, border: 0, background: '#0F2236', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Try again</button>
        </div>
      </body>
    </html>
  );
}

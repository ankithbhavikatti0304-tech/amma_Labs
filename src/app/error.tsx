'use client';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="wrap" style={{ maxWidth: 640, paddingBlock: 60 }}>
      <div className="empty">
        <h1 style={{ fontSize: 28 }}>Something went wrong</h1>
        <p>It&apos;s on our side, not yours. Please try again. If it keeps happening, call us and we&apos;ll book your test over the phone.</p>
        <button type="button" className="btn" onClick={reset}>Try again</button>
      </div>
    </div>
  );
}

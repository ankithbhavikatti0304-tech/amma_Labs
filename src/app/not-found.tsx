import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="wrap" style={{ maxWidth: 640, paddingBlock: 60 }}>
      <div className="empty">
        <h1 style={{ fontSize: 28 }}>We couldn&apos;t find that page</h1>
        <p>The link may be old, or the test may no longer be offered.</p>
        <Link className="btn" href="/tests">Browse all tests</Link>
      </div>
    </div>
  );
}

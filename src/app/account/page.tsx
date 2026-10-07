import type { Metadata } from 'next';
import Link from 'next/link';
import { getUser } from '@/server/auth/cookie';
import { getSavedDetails } from '@/server/account';
import { LoginPrompt } from '@/components/orders/OrderParts';
import { DeleteRequest, RemoveButton } from '@/components/orders/AccountParts';
import { GENDER_LABEL } from '@/lib/orders';

export const metadata: Metadata = { title: 'My details and privacy', robots: { index: false } };

export default async function AccountPage() {
  const user = await getUser();
  const saved = user ? await getSavedDetails(user.id) : null;
  return (
    <div className="wrap" style={{ maxWidth: 760 }}>
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>›</span><span>My details and privacy</span></nav>
      <div className="lhead"><div><h1>My details and privacy</h1></div></div>
      {!user || !saved ? <LoginPrompt next="/account" /> : (
        <div className="stack">
          <div className="panel">
            <h2 style={{ marginBottom: 6 }}>Saved for checkout</h2>
            <p className="muted" style={{ marginTop: 0 }}>These save you retyping. Removing one does not change past orders or reports.</p>
            <h3 style={{ fontSize: 15, margin: '14px 0 4px' }}>People</h3>
            {saved.patients.length ? saved.patients.map((p) => <div className="citem" key={p.id}><div className="grow"><b>{p.name}</b><span className="muted" style={{ fontSize: 13 }}>{p.age} y · {GENDER_LABEL[p.gender]}</span></div><RemoveButton endpoint={`/api/account/patients/${p.id}`} label="Person" /></div>) : <p className="muted">None saved yet.</p>}
            <h3 style={{ fontSize: 15, margin: '14px 0 4px' }}>Addresses</h3>
            {saved.addresses.length ? saved.addresses.map((a) => <div className="citem" key={a.id}><div className="grow"><b>{a.line}</b><span className="muted" style={{ fontSize: 13 }}>{a.pincode}</span></div><RemoveButton endpoint={`/api/account/addresses/${a.id}`} label="Address" /></div>) : <p className="muted">None saved yet.</p>}
          </div>
          <div className="panel">
            <h2 style={{ marginBottom: 6 }}>Your data</h2>
            <p className="muted" style={{ marginTop: 0 }}>Under India&apos;s data protection law you can see what we hold, correct it, and ask us to erase it. Read our <Link className="link" href="/privacy">privacy notice</Link>.</p>
            <div className="bar">
              <a className="btn ghost sm" href="/api/account/export" download>Download everything we hold (JSON)</a>
              <DeleteRequest />
            </div>
            <p className="muted" style={{ fontSize: 12.5, marginBottom: 0 }}>To correct a name or number, call us and we will update it. Opening or downloading a report is recorded for your protection.</p>
          </div>
        </div>
      )}
    </div>
  );
}

import Link from 'next/link';
import { CallbackForm, ThemeToggle } from './FooterParts';
import { Icon } from '@/components/Icon';
import type { PublicSettings } from '@/lib/catalogue';

function Brand() {
  return (
    <div className="brand" style={{ padding: 0 }}>
      <span className="brand-mark"><Icon name="drop" size={20} strokeWidth={2.3} /></span>
      <span><b>Amma Labs</b><small>Tested with a mother&apos;s care</small></span>
    </div>
  );
}

export function Footer({ settings }: { settings: PublicSettings }) {
  return (
    <footer className="foot">
      <div className="wrap foot-in">
        <div>
          <Brand />
          <p className="muted" style={{ marginTop: 14, maxWidth: '34ch', fontWeight: 500 }}>Blood tests with home sample collection. Reports on your phone, checked by our pathologist.</p>
        </div>
        <div>
          <h4>Explore</h4>
          <ul>
            <li><Link href="/category/full">Health packages</Link></li>
            <li><Link href="/tests">All tests</Link></li>
            <li><Link href="/orders">My orders &amp; reports</Link></li>
            <li><Link href="/privacy">Privacy notice</Link></li>
            <li><Link href="/account">My details &amp; data</Link></li>
          </ul>
        </div>
        <div>
          <h4>Need help?</h4>
          <p style={{ fontWeight: 600 }}>Call <a className="link" href={`tel:${settings.phone.replace(/\s/g, '')}`}>{settings.phone}</a> or get a call back.</p>
          <CallbackForm />
        </div>
      </div>
      <div className="wrap foot-base">
        <span>© {new Date().getFullYear()} Amma Labs, Bengaluru</span>
        <ThemeToggle />
      </div>
    </footer>
  );
}

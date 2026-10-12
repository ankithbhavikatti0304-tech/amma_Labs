import Link from 'next/link';
import { CartButton, CitySelect, NavLinks, SearchButton, UserButton } from './NavParts';
import { Icon } from '@/components/Icon';

export function Nav() {
  return (
    <header className="nav">
      <div className="nav-in">
        <Link className="brand" href="/" aria-label="Amma Labs home">
          <span className="brand-mark"><Icon name="drop" size={20} strokeWidth={2.3} /></span>
          <span><b>Amma Labs</b><small>Tested with a mother&apos;s care</small></span>
        </Link>
        <NavLinks />
        <span className="grow" />
        <CitySelect />
        <SearchButton />
        <UserButton />
        <CartButton />
      </div>
    </header>
  );
}

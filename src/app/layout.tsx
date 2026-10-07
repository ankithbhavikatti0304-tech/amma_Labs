import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import { AppProviders } from '@/components/providers';
import { Nav } from '@/components/chrome/Nav';
import { Footer } from '@/components/chrome/Footer';
import { Dock } from '@/components/chrome/Dock';
import { Toaster } from '@/components/chrome/Toaster';
import { SheetHost } from '@/components/chrome/Sheets';
import { SearchPalette } from '@/components/chrome/SearchPalette';
import { getCatalogue } from '@/server/catalogue';
import { getUser } from '@/server/auth/cookie';
import { CITIES, CITY_COOKIE, DEFAULT_CITY } from '@/config/lab';
import { env } from '@/server/env';

export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(env().APP_URL),
    title: { default: "Amma Labs — Tested with a mother's care", template: '%s · Amma Labs' },
    description: 'Book blood tests online with free home sample collection in Bengaluru. Reports on your phone with every value marked against its normal range.',
    applicationName: 'Amma Labs',
    openGraph: { type: 'website', siteName: 'Amma Labs', title: "Amma Labs — Tested with a mother's care", locale: 'en_IN' },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F2EFE7' },
    { media: '(prefers-color-scheme: dark)', color: '#0B131B' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading cookies first marks the page dynamic before anything touches the database, so `next build` needs no DB or secrets.
  const jar = await cookies();
  const [data, user] = await Promise.all([getCatalogue(), getUser()]);
  const theme = jar.get('al_theme')?.value;
  const cityCookie = jar.get(CITY_COOKIE)?.value;
  const city = (CITIES as readonly string[]).includes(cityCookie ?? '') ? (cityCookie as string) : DEFAULT_CITY;

  return (
    <html lang="en" data-theme={theme === 'light' || theme === 'dark' ? theme : undefined}>
      <body>
        <AppProviders data={data} user={user} city={city}>
          <div id="app-root">
            <a className="skip sr" href="#view">Skip to content</a>
            <Nav />
            <main id="view">{children}</main>
            <Footer settings={data.settings} />
            <Dock />
          </div>
          <SearchPalette />
          <SheetHost />
          <Toaster />
        </AppProviders>
      </body>
    </html>
  );
}

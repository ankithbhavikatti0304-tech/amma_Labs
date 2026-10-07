import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginPageForm } from '@/components/chrome/LoginPage';
import { getUser } from '@/server/auth/cookie';
import { safeNext } from '@/lib/safe-next';

export const metadata: Metadata = { title: 'Log in', robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = safeNext((await searchParams).next);
  if (await getUser()) redirect(next);
  return (
    <div className="wrap" style={{ maxWidth: 460, paddingBlock: 40 }}>
      <div className="panel">
        <h1 style={{ fontSize: 28, marginBottom: 6 }}>Log in</h1>
        <LoginPageForm next={next} />
      </div>
    </div>
  );
}

'use client';
import { useRouter } from 'next/navigation';
import { apiPost } from '@/lib/client/api';
import { toast } from '@/lib/client/ui';

export function LogoutButton() {
  const router = useRouter();
  return (
    <button type="button" className="chip" onClick={async () => {
      await apiPost('/api/auth/logout').catch(() => undefined);
      toast('Logged out');
      router.push('/');
      router.refresh();
    }}>Log out</button>
  );
}

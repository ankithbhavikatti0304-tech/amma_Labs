'use client';
import { useRouter } from 'next/navigation';
import { LoginFlow } from './LoginFlow';
import { toast } from '@/lib/client/ui';

export function LoginPageForm({ next }: { next: string }) {
  const router = useRouter();
  return (
    <LoginFlow
      onSuccess={(user) => {
        toast(`Welcome, ${user.name.split(/\s+/)[0]}`);
        router.replace(next);
        router.refresh();
      }}
    />
  );
}

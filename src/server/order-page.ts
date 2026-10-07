import 'server-only';
import { notFound } from 'next/navigation';
import { getUser } from './auth/cookie';
import { getOrderFor } from './orders';
import { ApiError } from './http-errors';
import { orderCode } from './schemas';
import type { OrderDTO } from '@/lib/orders';

/** For order pages: the signed-in person's order, or null if logged out. A code that isn't theirs is a 404. */
export async function loadOrder(code: string): Promise<{ order: OrderDTO | null; loggedIn: boolean }> {
  const user = await getUser();
  if (!user) return { order: null, loggedIn: false };
  const parsed = orderCode.safeParse(code);
  if (!parsed.success) notFound();
  try {
    return { order: await getOrderFor(user, parsed.data), loggedIn: true };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}


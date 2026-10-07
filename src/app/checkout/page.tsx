import type { Metadata } from 'next';
import { CheckoutForm } from '@/components/checkout/CheckoutForm';
import { requirePageUser } from '@/server/auth/cookie';
import { listSlotDays } from '@/server/slots';
import { getSavedDetails } from '@/server/account';
import { onlinePaymentsEnabled } from '@/server/payments';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false } };

export default async function CheckoutPage() {
  const user = await requirePageUser('/checkout');
  const [days, saved] = await Promise.all([listSlotDays(), getSavedDetails(user.id)]);
  return <CheckoutForm days={days} saved={saved} online={onlinePaymentsEnabled()} />;
}

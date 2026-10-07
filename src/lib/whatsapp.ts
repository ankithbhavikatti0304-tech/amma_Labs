import { inr } from './money';

export const waLink = (number: string, text?: string) => `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

/** The pre-filled message for "Book on WhatsApp". */
export function waCartText(city: string, items: { name: string; price: number }[], total: number): string {
  if (!items.length) return `Hi Amma Labs, I'd like to book a test in ${city}.`;
  return `Hi Amma Labs, I'd like to book these tests in ${city}:\n${items.map((t) => `• ${t.name} (${inr(t.price)})`).join('\n')}\nTotal: ${inr(total)}`;
}

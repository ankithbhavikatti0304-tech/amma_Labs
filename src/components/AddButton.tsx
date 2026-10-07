'use client';
import { cart, useInCart } from '@/lib/client/cart';
import { toast } from '@/lib/client/ui';
import { Icon } from './Icon';

/**
 * Add/remove from cart. Optimistic by construction: the cart is local, so this updates in
 * the same frame, and only buttons for this test re-render.
 */
export function AddButton({ id, name, className = '', onToggled }: { id: string; name: string; className?: string; onToggled?: (nowIn: boolean) => void }) {
  const on = useInCart(id);
  return (
    <button
      type="button"
      className={`add${on ? ' on' : ''} ${className}`.trim()}
      aria-pressed={on}
      aria-label={`${on ? 'Remove' : 'Add'} ${name}`}
      onClick={(e) => {
        const nowIn = cart.toggle(id);
        toast(nowIn ? 'Added to cart' : 'Removed from cart');
        const art = nowIn ? e.currentTarget.closest('.card')?.querySelector<HTMLElement>('.art') : null;
        if (art) {
          art.classList.remove('yay');
          void art.offsetWidth;
          art.classList.add('yay');
        }
        onToggled?.(nowIn);
      }}
    >
      {on ? <><Icon name="check" size={16} /><span>Added</span></> : <><Icon name="plus" size={16} /><span>Add</span></>}
    </button>
  );
}

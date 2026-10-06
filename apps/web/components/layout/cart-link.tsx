'use client';

import { cn, prefersReducedMotion } from '@hb/ui';
import { DURATION, EASE_SOFT_CSS } from '@hb/ui/motion';
import { ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { getCartCount, useCartCount } from '@/lib/cart-store';

/**
 * Header cart link with the item count (docs/p4-home.md §4). The count is client-only (0 on the
 * server) and sits absolutely on the icon, so it never shifts the header. It ticks when the count
 * rises, not when hydration first reveals a saved cart.
 */
export function CartLink({ className }: { className?: string }) {
  const count = useCartCount();
  const badge = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(null);

  useEffect(() => {
    if (shown.current === null) {
      // The hydration render shows 0 before the saved cart; start once the real count is shown.
      if (count === getCartCount()) shown.current = count;
      return;
    }
    const rose = count > shown.current;
    shown.current = count;
    const el = badge.current;
    if (!rose || !el || typeof el.animate !== 'function') return;
    el.animate(
      prefersReducedMotion()
        ? [{ opacity: 0.3 }, { opacity: 1 }]
        : [
            { transform: 'translateY(-40%) scale(0.7)', opacity: 0 },
            { transform: 'translateY(0) scale(1)', opacity: 1 },
          ],
      { duration: DURATION.base * 1000, easing: EASE_SOFT_CSS },
    );
  }, [count]);

  const label = count === 0 ? 'Cart' : `Cart, ${count} ${count === 1 ? 'item' : 'items'}`;
  return (
    // data-cart-target: where the product page's "fly to cart" copy lands (lib/fly-to-cart.ts).
    <Link href="/cart" aria-label={label} className={className} data-cart-target="">
      <ShoppingBag aria-hidden className="h-5 w-5" />
      {count > 0 && (
        <span
          ref={badge}
          aria-hidden
          className={cn(
            'absolute right-0.5 top-0.5 grid h-5 min-w-5 place-items-center rounded-pill bg-pink-600 px-1',
            'text-[11px] font-semibold leading-none tabular-nums text-white ring-2 ring-white',
          )}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}

'use client';

import { buttonVariants, cn, prefersReducedMotion } from '@hb/ui';
import { DURATION, EASE_SOFT_CSS } from '@hb/ui/motion';
import { Heart } from 'lucide-react';
import { useRef } from 'react';
import { toggleWishlist, useIsWishlisted } from '@/lib/wishlist-store';

const BURST_DOTS = 6;

type WishlistButtonProps = {
  productId: string;
  productSlug: string;
  title: string;
  /** `icon`: the heart beside Add to cart. `block`: "Save to wishlist" when out of stock. */
  variant?: 'icon' | 'block';
  className?: string;
};

/**
 * Wishlist heart for the buy box (docs/p5-catalog.md §5). A toggle button (`aria-pressed`) with
 * the same small burst as the product cards when it fills: transform and opacity only, skipped
 * under reduced motion.
 */
export function WishlistButton({
  productId,
  productSlug,
  title,
  variant = 'icon',
  className,
}: WishlistButtonProps) {
  const saved = useIsWishlisted(productId);
  const heart = useRef<HTMLSpanElement>(null);
  const burst = useRef<HTMLSpanElement>(null);

  function onClick() {
    if (!saved) playBurst(heart.current, burst.current);
    toggleWishlist({ productId, productSlug });
  }

  const icon = (
    <span aria-hidden className="relative grid place-items-center">
      <span ref={burst} className="pointer-events-none absolute inset-0">
        {Array.from({ length: BURST_DOTS }, (_, i) => (
          <span
            key={i}
            className={cn(
              'absolute left-1/2 top-1/2 -ml-[3px] -mt-[3px] h-1.5 w-1.5 rounded-pill opacity-0',
              i % 2 ? 'bg-gold-500' : 'bg-pink-400',
            )}
          />
        ))}
      </span>
      <span ref={heart} className="grid place-items-center">
        <Heart className={cn('h-5 w-5', saved && 'fill-pink-600 text-pink-600')} />
      </span>
    </span>
  );

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={variant === 'icon' ? `Save ${title} to wishlist` : undefined}
      onClick={onClick}
      className={cn(
        buttonVariants({ variant: 'secondary', size: variant === 'icon' ? 'icon' : 'md' }),
        // The burst dots fly outside the button.
        'overflow-visible',
        variant === 'icon' && 'h-12 w-12',
        className,
      )}
    >
      {icon}
      {variant === 'block' ? 'Save to wishlist' : null}
    </button>
  );
}

function playBurst(heart: HTMLElement | null, burst: HTMLElement | null) {
  if (!heart || !burst || typeof heart.animate !== 'function' || prefersReducedMotion()) return;
  const timing = { duration: DURATION.slow * 1000, easing: EASE_SOFT_CSS };
  heart.animate(
    [
      { transform: 'scale(0.6)' },
      { transform: 'scale(1.2)', offset: 0.55 },
      { transform: 'scale(1)' },
    ],
    timing,
  );
  Array.from(burst.children).forEach((dot, i) => {
    const angle = (i / BURST_DOTS) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * 22;
    const y = Math.sin(angle) * 22;
    dot.animate(
      [
        { transform: 'translate(0, 0) scale(0.4)', opacity: 1 },
        { transform: `translate(${x}px, ${y}px) scale(1)`, opacity: 0 },
      ],
      timing,
    );
  });
}

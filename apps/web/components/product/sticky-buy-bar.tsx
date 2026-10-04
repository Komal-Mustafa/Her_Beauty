'use client';

import { Button, cn, Price } from '@hb/ui';
import { useEffect, useState } from 'react';
import { useProduct } from './product-context';
import { variantLabel } from './variant-selection';

/**
 * Sticky buy bar below 1024 px (docs/p5-catalog.md §5): slides up once the buy box's Add to cart
 * has scrolled away above the viewport, and back down when it returns. From 1024 px the buy box
 * itself is sticky, so the bar is not displayed.
 *
 * It is `position: sticky` at the very end of the page's main content, not `fixed`: its box keeps
 * its own space there, so the last content and the footer can always scroll clear of it. Hidden, it
 * is `inert` (no focus, not announced).
 */
export function StickyBuyBar() {
  const { product, kind, variant, add, mainAddRef } = useProduct();
  const [shown, setShown] = useState(false);
  const outOfStock = variant.stock <= 0;

  // The buy box swaps its button for "Out of stock" (a new element) when stock runs out.
  useEffect(() => {
    const el = mainAddRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry) setShown(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [mainAddRef, outOfStock]);

  const label = variantLabel(variant, kind);

  return (
    <div className="sticky bottom-0 z-30 md:hidden">
      <div
        inert={!shown}
        className={cn(
          'border-t border-ink-200 bg-white/95 shadow-lift backdrop-blur transition duration-slow ease-soft',
          'px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3',
          shown ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0',
          'motion-reduce:translate-y-0',
        )}
      >
        <div className="mx-auto flex max-w-[1280px] items-center gap-3">
          {variant.shadeHex ? (
            // Shade colours are product data (variant.shade_hex), not UI tokens.
            <span
              aria-hidden
              className="h-8 w-8 shrink-0 rounded-pill border border-ink-200 ring-2 ring-gold-500 ring-offset-2"
              style={{ backgroundColor: variant.shadeHex }}
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink-900">{label ?? product.title}</p>
            <Price
              amount={variant.price}
              compareAt={variant.compareAtPrice}
              currency={variant.currency}
              size="sm"
              className="gap-x-1.5 gap-y-0"
            />
          </div>
          <Button
            disabled={outOfStock}
            onClick={(e) => add(e.currentTarget)}
            className="shrink-0 px-5"
          >
            {outOfStock ? 'Out of stock' : 'Add to cart'}
          </Button>
        </div>
      </div>
    </div>
  );
}

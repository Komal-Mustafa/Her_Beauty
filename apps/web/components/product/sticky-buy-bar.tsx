'use client';

import { Button, cn, Price } from '@hb/ui';
import { useEffect, useRef, useState } from 'react';
import { useProduct } from './product-context';
import { variantLabel } from './variant-selection';

/** How far below the window the observer's root reaches: more than any page is long. */
const FAR_BELOW = 100_000;

/**
 * Sticky buy bar below 1024 px (docs/p5-catalog.md §5): fixed to the bottom of the window, it slides
 * up once the buy box's Add to cart has scrolled away above the viewport, and back down when it
 * returns. From 1024 px the buy box itself is sticky, so the bar is not displayed.
 *
 * Shown, it reserves its height at the bottom of the window: as bottom padding on the page (so the
 * footer and the last content can always scroll clear of it), for focus scrolling
 * (`scroll-padding-bottom`) and for the toasts (`--toast-offset`), so no content, focused control
 * or toast ends up behind it (docs/p5-catalog.md §9). Being fixed, it is always where those values
 * say. Hidden, it is `inert` (no focus, not announced) and lets taps through to the page under it.
 */
export function StickyBuyBar() {
  const { product, kind, variant, add, mainAddRef } = useProduct();
  const [shown, setShown] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const outOfStock = variant.stock <= 0;

  // The buy box swaps its button for "Out of stock" (a new element) when stock runs out.
  useEffect(() => {
    const el = mainAddRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry) setShown(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      // The root reaches far below the window, so the button counts as intersecting while it is on
      // screen or anywhere below, and stops only once it is above. Any move between the two then
      // crosses an edge, a jump to #reviews or back to the top included; with the bare window as
      // root such a jump goes from "out below" to "out above" and the observer never reports it.
      { rootMargin: `0px 0px ${FAR_BELOW}px 0px` },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mainAddRef, outOfStock]);

  useEffect(() => {
    const el = barRef.current;
    if (!shown || !el) return;
    const root = document.documentElement;
    const page = document.body;
    const release = () => {
      root.style.removeProperty('scroll-padding-bottom');
      root.style.removeProperty('--toast-offset');
      page.style.removeProperty('padding-bottom');
    };
    const reserve = () => {
      // 0 from 1024 px, where the bar is not displayed.
      const height = el.offsetHeight;
      if (!height) {
        release();
        return;
      }
      root.style.setProperty('scroll-padding-bottom', `calc(${height}px + 1rem)`);
      root.style.setProperty('--toast-offset', `${height}px`);
      page.style.setProperty('padding-bottom', `${height}px`);
    };
    reserve();
    // The height changes with the window (the bar's text, safe area) and to 0 at 1024 px.
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(reserve);
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      release();
    };
  }, [shown]);

  const label = variantLabel(variant, kind);

  return (
    // The wrapper never takes taps (its box stays at the bottom of the window even while the bar
    // is hidden); the panel does, only while it is shown.
    <div
      ref={barRef}
      data-sticky-buy-bar=""
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 md:hidden"
    >
      <div
        inert={!shown}
        className={cn(
          'border-t border-ink-200 bg-white/95 shadow-lift backdrop-blur transition duration-slow ease-soft',
          'px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3',
          shown
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-full opacity-0',
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

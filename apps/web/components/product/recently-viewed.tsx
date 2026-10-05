'use client';

import type { ProductCard } from '@hb/types';
import { useEffect, useMemo, useState } from 'react';
import { recentExcept, useRecentlyViewed } from '@/lib/recent-store';
import { ProductCarousel } from './product-carousel';

type RecentlyViewedProps = {
  /** The product on show, left out of the row. */
  productId: string;
  /** The `recentlyViewedCards` server action (a prop, so tests can pass their own). */
  loadCards: (ids: string[]) => Promise<ProductCard[]>;
};

/**
 * "Recently viewed" at the foot of the product page (docs/p5-catalog.md §5 "Carousels"): the
 * other products in `hb_recent_v1`, newest first, at most 12, as current cards from the API (in
 * the stored order; hidden or unknown products are skipped). Renders nothing until there is at
 * least one card, and it is the last thing on the page, so arriving late shifts nothing.
 */
export function RecentlyViewed({ productId, loadCards }: RecentlyViewedProps) {
  const recent = useRecentlyViewed();
  // By content: recording this very view changes the stored list but not the others in it, and
  // must not load them again.
  const key = JSON.stringify(recentExcept(recent, productId).map((item) => item.productId));
  const ids = useMemo(() => JSON.parse(key) as string[], [key]);
  const [cards, setCards] = useState<ProductCard[] | null>(null);

  useEffect(() => {
    if (!ids.length) return;
    let current = true;
    loadCards(ids).then(
      (items) => {
        if (current) setCards(items);
      },
      () => {
        // Decorative: a failed load keeps whatever is on show (nothing, at first).
      },
    );
    return () => {
      current = false;
    };
  }, [ids, loadCards]);

  // While another list loads (after a view in another tab) the previous cards stay, without the
  // product on show.
  if (!ids.length || !cards) return null;
  return (
    <ProductCarousel
      id="recently-viewed"
      eyebrow="Your history"
      title="Recently viewed"
      products={cards.filter((p) => p.id !== productId)}
    />
  );
}

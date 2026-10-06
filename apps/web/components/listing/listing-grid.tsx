'use client';

import type { ProductCard } from '@hb/types';
import { cn, Reveal } from '@hb/ui';
import { useEffect, useState } from 'react';
import { ShopProductCard } from '@/components/product/shop-product-card';

/** Cards with `priority` images: the first row on a wide screen, the LCP candidates. */
const PRIORITY = 4;

/**
 * At 3 columns (768–1279 px) the 4 cards drawn at once end in the middle of row 2: the rest of
 * that row is drawn at once too, so a row never half rises (§8 "stagger by column"). CSS, so the
 * server's markup is right at every width before hydration; `!` beats the inline styles Reveal
 * animates. (At 2 columns the 4 fill rows 1 and 2; at 4 columns, row 1.)
 */
const ROW_END_AT_3 = 6;
const STILL_AT_3 = 'sm:max-lg:!transform-none sm:max-lg:!opacity-100';

/** Columns per width (docs/p5-catalog.md §2.1): 2, then 3 from 768 px and 4 from 1280 px. */
const WIDE_COLUMNS = [
  { query: '(min-width: 80rem)', columns: 4 },
  { query: '(min-width: 48rem)', columns: 3 },
] as const;
const NARROW_COLUMNS = 2;

function gridColumns(): number {
  if (typeof window === 'undefined') return WIDE_COLUMNS[0].columns;
  for (const { query, columns } of WIDE_COLUMNS) {
    if (window.matchMedia(query).matches) return columns;
  }
  return NARROW_COLUMNS;
}

/**
 * The columns the grid has right now, so the rise-in stagger runs along a row and starts again on
 * the next one (§8 "stagger by column"). Only the animation delay depends on it, never the markup,
 * so it is read from the window while hydrating and followed as the window is resized.
 */
function useGridColumns(): number {
  const [columns, setColumns] = useState(gridColumns);
  useEffect(() => {
    const update = () => setColumns(gridColumns());
    update();
    const queries = WIDE_COLUMNS.map(({ query }) => window.matchMedia(query));
    for (const query of queries) query.addEventListener('change', update);
    return () => {
      for (const query of queries) query.removeEventListener('change', update);
    };
  }, []);
  return columns;
}

/**
 * The product grid of a listing page (docs/p5-catalog.md §2.1): 2 columns, 3 from 768 px, 4 from
 * 1280 px (beside the filters from 1024 px). Cards rise in with `Reveal`, staggered by column
 * (§8); the first 4 cards are the LCP, so they (and the rest of their row) are drawn at once
 * with priority images instead.
 */
export function ListingGrid({ products }: { products: readonly ProductCard[] }) {
  const columns = useGridColumns();
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
      {products.map((p, i) => {
        const card = (
          <ShopProductCard
            product={p}
            priority={i < PRIORITY}
            headingLevel="h3"
            sizes="(min-width: 1280px) 216px, (min-width: 1024px) 24vw, (min-width: 768px) 30vw, 50vw"
            className="flex-1"
          />
        );
        return i < PRIORITY ? (
          <li key={p.id} className="flex">
            {card}
          </li>
        ) : (
          <Reveal
            as="li"
            key={p.id}
            index={i % columns}
            className={cn('flex', i < ROW_END_AT_3 && STILL_AT_3)}
          >
            {card}
          </Reveal>
        );
      })}
    </ul>
  );
}

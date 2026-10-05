import type { ProductCard } from '@hb/types';
import { Reveal } from '@hb/ui';
import { ShopProductCard } from '@/components/product/shop-product-card';

/** Cards with `priority` images: the first row on a wide screen, the LCP candidates. */
const PRIORITY = 4;
/** Columns at the widest grid; the rise-in stagger restarts every row. */
const COLUMNS = 4;

/**
 * The product grid of a listing page (docs/p5-catalog.md §2.1): 2 columns, 3 from 768 px, 4 from
 * 1280 px (beside the filters from 1024 px). Cards rise in with `Reveal`, staggered across a row
 * (§8); the first row is the LCP, so it is drawn at once with priority images instead.
 */
export function ListingGrid({ products }: { products: readonly ProductCard[] }) {
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
          <Reveal as="li" key={p.id} index={i % COLUMNS} className="flex">
            {card}
          </Reveal>
        );
      })}
    </ul>
  );
}

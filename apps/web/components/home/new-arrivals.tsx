import type { ProductCard } from '@hb/types';
import { Button, Reveal, SectionHeading } from '@hb/ui';
import Link from 'next/link';
import { ShopProductCard } from '@/components/product/shop-product-card';

/**
 * Home §4 (docs/p4-home.md §2): the newest products in a grid sized by the centre column
 * (container queries), 2 → 3 → 4 across. At 3 across only the first six show, so every row is
 * full. Cards rise in with a stagger.
 */
export function NewArrivals({ products }: { products: readonly ProductCard[] }) {
  if (products.length === 0) return null;
  return (
    <section aria-labelledby="new-title">
      <SectionHeading
        eyebrow="Just landed"
        title={<span id="new-title">New arrivals</span>}
        action={
          <Button asChild variant="secondary" size="sm" className="self-start md:self-end">
            <Link href="/new">See all new arrivals</Link>
          </Button>
        }
      />
      <ul className="grid grid-cols-2 gap-x-4 gap-y-8 @2xl:grid-cols-3 @2xl:gap-x-6 @4xl:grid-cols-4">
        {products.map((p, i) => (
          <Reveal
            as="li"
            key={p.id}
            index={i % 4}
            className={i >= 6 ? 'flex @2xl:hidden @4xl:flex' : 'flex'}
          >
            <ShopProductCard
              product={p}
              headingLevel="h3"
              sizes="(min-width: 1280px) 280px, (min-width: 768px) 30vw, 50vw"
              className="flex-1"
            />
          </Reveal>
        ))}
      </ul>
    </section>
  );
}

import type { ProductCard } from '@hb/types';
import { Carousel, SectionHeading } from '@hb/ui';
import { ShopProductCard } from './shop-product-card';

type ProductCarouselProps = {
  /** Used for the heading id and the carousel's accessible name. */
  id: string;
  eyebrow: string;
  title: string;
  products: readonly ProductCard[];
};

/** A row of product cards under the product page (More from the store, Similar products). */
export function ProductCarousel({ id, eyebrow, title, products }: ProductCarouselProps) {
  if (products.length === 0) return null;
  return (
    // The Carousel is itself a region named by `title`, so this is not another <section>.
    <div className="-mb-6">
      <Carousel
        label={title}
        header={
          <SectionHeading
            eyebrow={eyebrow}
            title={<span id={`${id}-title`}>{title}</span>}
            className="mb-3"
          />
        }
      >
        {products.map((p) => (
          <ShopProductCard
            key={p.id}
            product={p}
            headingLevel="h3"
            sizes="(min-width: 1024px) 290px, (min-width: 768px) 30vw, 70vw"
            className="h-full"
          />
        ))}
      </Carousel>
    </div>
  );
}

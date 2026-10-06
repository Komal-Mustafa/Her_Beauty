import type { ProductCard, Store } from '@hb/types';
import { Badge, Button, Rating } from '@hb/ui';
import Image from 'next/image';
import Link from 'next/link';

type SellerCardProps = {
  /** The seller as the product knows it (always there). */
  seller: ProductCard['seller'];
  /** The full store, when it could be loaded: adds the logo, city and rating. */
  store: Store | null;
};

const TYPE_LABEL = { vendor: 'Vendor', manufacturer: 'Manufacturer' } as const;

/**
 * Who sells the product (docs/p5-catalog.md §5 "Seller card"): logo circle, store name and badge,
 * Vendor or Manufacturer, city, rating and a way to the store.
 */
export function SellerCard({ seller, store }: SellerCardProps) {
  const href = `/store/${seller.slug}`;
  const official = seller.badge === 'official_brand';
  const facts = [TYPE_LABEL[seller.type], store?.city].filter(Boolean).join(' · ');
  return (
    // Sized by its own width (container query): the buy box is full width on phones, 40 % on desktop.
    <section
      aria-labelledby="seller-title"
      className="@container rounded-card border border-ink-200 bg-white p-4"
    >
      <div className="flex flex-col gap-4 @sm:flex-row @sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-pill border border-gold-500 bg-blush-50">
            {store?.logo ? (
              <Image src={store.logo.url} alt="" fill sizes="56px" className="object-cover" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink-500">Sold by</p>
            <h2 id="seller-title" className="font-sans text-base font-medium leading-snug">
              <Link
                href={href}
                className="inline-flex min-h-11 items-center text-ink-900 underline-offset-4 hover:text-pink-700 hover:underline"
              >
                {seller.storeName}
              </Link>
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-500">
              <Badge kind={official ? 'official' : 'verified'} className="whitespace-nowrap" />
              <span>{facts}</span>
            </p>
            {store && store.rating > 0 ? (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-500">
                <Rating value={store.rating} compact />
                <span>seller rating</span>
              </p>
            ) : null}
          </div>
        </div>
        <Button asChild variant="secondary" size="sm" className="h-11 shrink-0">
          <Link href={href}>Visit store</Link>
        </Button>
      </div>
    </section>
  );
}

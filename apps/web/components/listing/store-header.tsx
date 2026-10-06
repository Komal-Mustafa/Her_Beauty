import type { Store } from '@hb/types';
import { Badge, cn, Rating } from '@hb/ui';
import { CalendarDays, MapPin, Store as StoreIcon } from 'lucide-react';
import Image from 'next/image';
import { productCount } from '@/lib/listing-url';

const TYPE_LABEL = { vendor: 'Vendor', manufacturer: 'Manufacturer' } as const;

/** "January 2026", in Pakistan time (the marketplace's own timezone). */
function joinedLabel(iso: string): string {
  return new Intl.DateTimeFormat('en-PK', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Karachi',
  }).format(new Date(iso));
}

type StoreHeaderProps = {
  store: Store;
  /** Products matching the filters (the store's whole range without them). */
  total: number;
  /** Any filter is applied: the count then reads "3 of 6 products". */
  filtered: boolean;
  className?: string;
};

/**
 * Store page header (docs/p5-catalog.md §1): banner, logo circle overlapping it, the store name as
 * H1, its badge (Verified Seller / Official Brand), Vendor or Manufacturer, city, rating, the
 * month it joined, its product count and about text.
 */
export function StoreHeader({ store, total, filtered, className }: StoreHeaderProps) {
  const official = store.badge === 'official_brand';
  const count = filtered
    ? `${total.toLocaleString('en-PK')} of ${productCount(store.productCount)}`
    : productCount(store.productCount);
  return (
    <header className={cn('flex flex-col', className)}>
      <div className="relative aspect-[16/7] overflow-hidden rounded-card bg-blush-50 sm:aspect-[4/1]">
        <Image
          src={store.banner.url}
          alt=""
          fill
          priority
          sizes="(min-width: 1280px) 1232px, 100vw"
          className="object-cover"
        />
      </div>
      {/* Only the logo is pulled up over the banner (it paints above it); the name starts below
          the banner's edge, so a long, wrapping name is never drawn under the image. */}
      <div className="flex flex-col gap-4 px-2 sm:flex-row sm:items-start sm:gap-6 sm:px-6">
        <span className="relative -mt-10 h-20 w-20 shrink-0 overflow-hidden rounded-pill border-2 border-gold-500 bg-white shadow-lift sm:-mt-14 sm:h-28 sm:w-28">
          <Image
            src={store.logo.url}
            alt={store.logo.alt}
            fill
            sizes="112px"
            className="object-cover"
          />
        </span>
        <div className="flex min-w-0 flex-col gap-2 sm:pt-4">
          <p className="eyebrow text-gold-800">Store</p>
          <h1 className="font-display text-[34px] font-semibold leading-tight text-balance text-ink-900 [overflow-wrap:anywhere] md:text-[56px]">
            {store.storeName}
          </h1>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3 px-2 sm:px-6">
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-500">
          <li>
            <Badge kind={official ? 'official' : 'verified'} />
          </li>
          <li className="inline-flex items-center gap-1.5">
            <StoreIcon aria-hidden className="h-4 w-4 text-gold-600" />
            {TYPE_LABEL[store.type]}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <MapPin aria-hidden className="h-4 w-4 text-gold-600" />
            {store.city}
          </li>
          {store.rating > 0 ? (
            <li className="inline-flex items-center gap-1.5">
              <Rating value={store.rating} compact />
              <span>seller rating</span>
            </li>
          ) : null}
          <li className="inline-flex items-center gap-1.5">
            <CalendarDays aria-hidden className="h-4 w-4 text-gold-600" />
            Joined {joinedLabel(store.joinedAt)}
          </li>
          <li className="tabular-nums">{count}</li>
        </ul>
        {store.about ? <p className="max-w-2xl text-ink-900">{store.about}</p> : null}
      </div>
    </header>
  );
}

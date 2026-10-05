import type { ServedAd } from '@hb/types';
import { Badge, Button, cn } from '@hb/ui';
import Image from 'next/image';
import Link from 'next/link';

/**
 * The category banner (docs/p5-catalog.md §2.1): one booked `category_banner` ad above the grid,
 * image left and headline with CTA right (stacked below 768 px), always labelled Sponsored
 * (PRD §7.6), linking to the ad's own page. No booking, no banner.
 *
 * TODO(P9): impression and click tracking.
 */
export function CategoryBannerAd({ ad, className }: { ad: ServedAd; className?: string }) {
  const image = ad.media.kind === 'image' ? ad.media.url : ad.media.posterUrl;
  return (
    <aside
      aria-label="Sponsored"
      className={cn(
        'overflow-hidden rounded-card border border-gold-500 bg-white shadow-soft sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]',
        className,
      )}
    >
      {image ? (
        <div className="relative aspect-[16/9] bg-blush-50 sm:aspect-auto sm:min-h-56">
          {/* The headline says what the ad shows. */}
          <Image
            src={image}
            alt=""
            fill
            sizes="(min-width: 768px) 40vw, 100vw"
            className="object-cover"
          />
        </div>
      ) : null}
      <div className="flex flex-col items-start justify-center gap-2 p-6 sm:p-8 md:p-10">
        <Badge kind="sponsored" />
        <p className="mt-1 text-sm text-ink-500">{ad.sellerName}</p>
        <p className="font-display text-2xl font-medium leading-snug text-balance text-ink-900 md:text-[28px]">
          {ad.headline}
        </p>
        <Button asChild className="mt-3">
          {/* No prefetch: a paid link is fetched only when it is followed. */}
          <Link href={ad.href} prefetch={false}>
            {ad.ctaLabel}
          </Link>
        </Button>
      </div>
    </aside>
  );
}

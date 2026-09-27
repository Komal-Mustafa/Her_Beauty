import type { FeaturedReview, StorefrontStats } from '@hb/types';
import { CountUp, Rating, SectionHeading } from '@hb/ui';
import { BadgeCheck } from 'lucide-react';
import Link from 'next/link';

const STATS: readonly { key: keyof StorefrontStats; label: string }[] = [
  { key: 'verifiedSellers', label: 'Verified sellers' },
  { key: 'officialBrands', label: 'Official brands' },
  { key: 'products', label: 'Products' },
  { key: 'ordersDelivered', label: 'Orders delivered' },
];

/**
 * Home §6 (docs/p4-home.md §2): featured verified-purchase reviews (up to three, one per shopper)
 * and storefront counters that count up once when they come into view. The trust strip is the
 * footer's, which follows straight after this section.
 */
export function LovedByShoppers({
  reviews,
  stats,
}: {
  reviews: readonly FeaturedReview[];
  stats: StorefrontStats;
}) {
  return (
    <section aria-labelledby="loved-title">
      <SectionHeading
        eyebrow="Real reviews"
        title={<span id="loved-title">Loved by shoppers</span>}
        description="Only shoppers who bought and received an order can review it."
      />

      {reviews.length > 0 ? (
        <ul className="grid gap-4 @2xl:grid-cols-[repeat(auto-fit,minmax(0,1fr))] @4xl:gap-6">
          {reviews.map((r) => (
            <li key={r.id}>
              <figure className="flex h-full flex-col gap-4 rounded-card border border-ink-200 bg-white p-5 shadow-soft @4xl:p-6">
                <Rating value={r.rating} />
                <blockquote className="flex-1">
                  <p className="font-display text-lg font-medium text-ink-900">{r.title}</p>
                  <p className="mt-2 text-ink-500">“{r.body}”</p>
                </blockquote>
                <figcaption className="flex flex-col gap-1 border-t border-ink-200 pt-4 text-sm">
                  <span className="font-medium text-ink-900">{r.authorName}</span>
                  <span className="inline-flex items-center gap-1 text-ink-500">
                    <BadgeCheck aria-hidden className="h-4 w-4 text-gold-600" />
                    Verified purchase
                  </span>
                  <Link
                    href={`/product/${r.product.slug}`}
                    className="inline-flex min-h-11 items-center text-pink-600 underline-offset-2 hover:underline"
                  >
                    {r.product.title}
                  </Link>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      ) : null}

      <dl className="mt-10 grid grid-cols-2 gap-4 @xl:grid-cols-4 @4xl:gap-6">
        {STATS.map(({ key, label }) => (
          <div
            key={key}
            className="flex flex-col-reverse items-center gap-1 rounded-card border border-gold-500 bg-white px-4 py-6 text-center"
          >
            <dt className="text-sm text-ink-500">{label}</dt>
            <dd className="font-display text-[28px] font-semibold text-pink-600 md:text-[40px]">
              <CountUp value={stats[key]} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

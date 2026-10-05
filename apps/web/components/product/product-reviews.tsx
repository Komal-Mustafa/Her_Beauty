import type { Product, Review } from '@hb/types';
import { SectionHeading } from '@hb/ui';
import { BadgeCheck, ShieldCheck } from 'lucide-react';
import { ReviewPhotos } from './review-photos';
import { Stars } from './stars';

/** Reviews listed on the page, newest first. */
export const REVIEWS_SHOWN = 12;

// Server-rendered; dates show in Pakistan time (rules.md §2: stored in UTC, shown local).
const DATE = new Intl.DateTimeFormat('en-PK', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Karachi',
});

type ProductReviewsProps = {
  product: Product;
  /** null when the reviews could not be loaded. */
  reviews: readonly Review[] | null;
};

/**
 * Reviews (`#reviews`, docs/p5-catalog.md §5): the average, stars and rating count, the
 * verified-purchase rule, then the newest review cards with photo lightboxes.
 */
export function ProductReviews({ product, reviews }: ProductReviewsProps) {
  const newest = reviews
    ? [...reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, REVIEWS_SHOWN)
    : null;
  const count = product.ratingCount;

  return (
    <section id="reviews" aria-labelledby="reviews-title">
      <SectionHeading eyebrow="Verified buyers" title={<span id="reviews-title">Reviews</span>} />
      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-12">
        <div className="flex flex-col gap-3 self-start rounded-card bg-blush-50 p-6">
          {count > 0 ? (
            <>
              {/* Read once, by the stars below ("4.8 out of 5 stars"). */}
              <p
                aria-hidden
                className="font-display text-[56px] font-semibold leading-none text-ink-900"
              >
                {product.rating.toFixed(1)}
              </p>
              <Stars value={product.rating} size="lg" />
              <p className="text-sm text-ink-500">
                {count.toLocaleString('en-PK')} {count === 1 ? 'rating' : 'ratings'}
              </p>
            </>
          ) : (
            <p className="font-display text-2xl text-ink-900">No ratings yet</p>
          )}
          <p className="flex gap-2 border-t border-ink-200 pt-4 text-sm text-ink-500">
            <ShieldCheck aria-hidden className="h-5 w-5 shrink-0 text-gold-600" strokeWidth={1.5} />
            Only shoppers who received this product can review it.
          </p>
        </div>

        <div>
          {newest === null ? (
            <p className="text-ink-500">We couldn’t load the reviews right now.</p>
          ) : newest.length === 0 ? (
            <p className="text-ink-500">No written reviews yet.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-4">
                {newest.map((r) => (
                  <li key={r.id}>
                    <ReviewCard review={r} />
                  </li>
                ))}
              </ul>
              {reviews && reviews.length > newest.length ? (
                <p className="mt-4 text-sm text-ink-500">
                  Showing the {newest.length} newest of {reviews.length} reviews.
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <article className="rounded-card border border-ink-200 bg-white p-5 md:p-6">
      <Stars value={review.rating} />
      <h3 className="mt-3 font-sans text-base font-semibold text-ink-900">{review.title}</h3>
      {review.body ? <p className="mt-2 text-ink-900">{review.body}</p> : null}
      <ReviewPhotos photos={review.photos} author={review.authorName} />
      <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-500">
        <span className="font-medium text-ink-900">{review.authorName}</span>
        <time dateTime={review.createdAt}>{DATE.format(new Date(review.createdAt))}</time>
        <span className="inline-flex items-center gap-1">
          <BadgeCheck aria-hidden className="h-4 w-4 text-gold-600" />
          Verified purchase
        </span>
      </p>
    </article>
  );
}

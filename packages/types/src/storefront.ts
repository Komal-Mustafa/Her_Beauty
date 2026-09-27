import { z } from 'zod';
import { Brand, Review } from './catalog';
import { Slug } from './common';

// Home page highlights (docs/p4-home.md §2 section 3 and 6, §6).

/** Trust counters under "Loved by shoppers". GET /stats/storefront. */
export const StorefrontStats = z.object({
  /** Approved, not deleted sellers. */
  verifiedSellers: z.number().int().nonnegative(),
  /** Protected (trademark-verified) brands whose owner, if any, is a visible seller. */
  officialBrands: z.number().int().nonnegative(),
  /** Live products of visible sellers. */
  products: z.number().int().nonnegative(),
  /** Seller orders that reached the customer (delivered, or delivered and released). */
  ordersDelivered: z.number().int().nonnegative(),
});
export type StorefrontStats = z.infer<typeof StorefrontStats>;

export const FEATURED_REVIEWS_DEFAULT = 3;
export const FEATURED_REVIEWS_MAX = 12;
/** Stars a review needs to be featured on the home page. */
export const FEATURED_REVIEW_MIN_RATING = 4;
/** Featured brands scroll in a marquee, not a directory: at most this many. */
export const FEATURED_BRANDS_MAX = 24;

/** GET /reviews/featured?limit= */
export const FeaturedReviewQuery = z.object({
  limit: z.number().int().min(1).max(FEATURED_REVIEWS_MAX).optional(),
});
export type FeaturedReviewQuery = z.infer<typeof FeaturedReviewQuery>;

/** A 4–5 star verified review with a quote, shown on the home page with a link to its product. */
export const FeaturedReview = Review.extend({
  rating: z.number().int().min(FEATURED_REVIEW_MIN_RATING).max(5),
  body: z.string().min(1),
  product: z.object({ slug: Slug, title: z.string() }),
});
export type FeaturedReview = z.infer<typeof FeaturedReview>;

/** Paid brand placement: Icon package = "top", Luxe = "featured". Always rendered "Sponsored". */
export const FeaturedBrandPlacement = z.enum(['top', 'featured']);
export type FeaturedBrandPlacement = z.infer<typeof FeaturedBrandPlacement>;

/** GET /brands/featured — top placements first. */
export const FeaturedBrand = Brand.extend({ placement: FeaturedBrandPlacement });
export type FeaturedBrand = z.infer<typeof FeaturedBrand>;

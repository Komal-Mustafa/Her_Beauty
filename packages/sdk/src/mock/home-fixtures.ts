import type {
  AdPackageCode,
  FeaturedBrand,
  FeaturedBrandPlacement,
  FeaturedReview,
  StorefrontStats,
} from '@hb/types';
import { FEATURED_BRANDS_MAX, FEATURED_REVIEW_MIN_RATING } from '@hb/types';
import { adPackages, brands, products, reviews, stores } from './fixtures';

/*
 * Mock data for the home page highlights (docs/p4-home.md §6). Everything is derived from the
 * storefront fixtures with the same rules as the API (apps/api/src/storefront), so mock mode and
 * http mode on a freshly seeded database show the same numbers, reviews and brands. Reviews with
 * the same createdAt are ordered by id, and fixture ids are not the seeded UUIDs, so such ties
 * may come in another order in http mode.
 */

/** Descending order for ISO dates and ids (plain code-unit order, like the database). */
const desc = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0);

/**
 * Active ad subscription of each advertiser — mirrors `packageFor` in packages/db/prisma/seed.ts
 * (a seller's first served ad decides its package: hero → Icon, left_3d → Luxe, else Radiance).
 */
export const adSubscriptions: { sellerId: string; packageCode: AdPackageCode }[] = [
  { sellerId: 'sel-rosehouse', packageCode: 'icon' },
  { sellerId: 'sel-glow', packageCode: 'luxe' },
  { sellerId: 'sel-velvet', packageCode: 'luxe' },
  { sellerId: 'sel-skinlab', packageCode: 'radiance' },
  { sellerId: 'sel-beautypoint', packageCode: 'radiance' },
];

/**
 * The seed turns each reviewer's reviews into one delivered order per seller, so the delivered
 * seller orders are the distinct (reviewer, seller) pairs.
 */
function deliveredSellerOrders(): number {
  const sellerOf = new Map(products.map((p) => [p.id, p.seller.id]));
  return new Set(reviews.map((r) => `${r.authorName}|${sellerOf.get(r.productId) ?? ''}`)).size;
}

/** Every mock store is approved and every mock product is live. */
export const storefrontStats: StorefrontStats = {
  verifiedSellers: stores.length,
  officialBrands: brands.filter((b) => b.isProtected).length,
  products: products.length,
  ordersDelivered: deliveredSellerOrders(),
};

/** 4–5 star verified reviews with a quote, newest first (id breaks ties). */
export const featuredReviews: FeaturedReview[] = reviews
  .filter((r) => r.rating >= FEATURED_REVIEW_MIN_RATING && r.verifiedPurchase && r.body !== '')
  .flatMap((r) => {
    const product = products.find((p) => p.id === r.productId);
    return product ? [{ ...r, product: { slug: product.slug, title: product.title } }] : [];
  })
  .sort((a, b) => desc(a.createdAt, b.createdAt) || desc(a.id, b.id));

const PLACEMENT_RANK: Record<FeaturedBrandPlacement, number> = { top: 0, featured: 1 };

/** Protected brands owned by Icon ("top") and Luxe ("featured") advertisers; top first, then name. */
function buildFeaturedBrands(): FeaturedBrand[] {
  const placementBySeller = new Map<string, FeaturedBrandPlacement>();
  for (const sub of adSubscriptions) {
    const level = adPackages.find((p) => p.code === sub.packageCode)?.featuredBrand;
    if (level === 'top' || level === 'yes') {
      placementBySeller.set(sub.sellerId, level === 'top' ? 'top' : 'featured');
    }
  }
  const visibleSellers = new Set(stores.map((s) => s.id));
  return brands
    .flatMap((b) => {
      const placement = b.ownerSellerId ? placementBySeller.get(b.ownerSellerId) : undefined;
      if (!placement || !b.isProtected || !visibleSellers.has(b.ownerSellerId ?? '')) return [];
      return [{ ...b, placement }];
    })
    .sort(
      (a, b) =>
        PLACEMENT_RANK[a.placement] - PLACEMENT_RANK[b.placement] ||
        a.name.localeCompare(b.name, 'en'),
    )
    .slice(0, FEATURED_BRANDS_MAX);
}

export const featuredBrands: FeaturedBrand[] = buildFeaturedBrands();

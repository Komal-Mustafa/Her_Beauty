import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, SellerOrderStatus } from '@hb/db';
import {
  FEATURED_BRANDS_MAX,
  FEATURED_REVIEW_MIN_RATING,
  FEATURED_REVIEWS_SCAN_FACTOR,
  type FeaturedBrand,
  type FeaturedBrandPlacement,
  type FeaturedReview,
  type StorefrontStats,
} from '@hb/types';
import { featuredBrandLevel } from '../ads/ads.service';
import { LIVE, LIVE_SELLER, VISIBLE_BRAND } from '../catalog/catalog.service';
import { toBrand, toReview } from '../catalog/mappers';
import { PrismaService } from '../prisma/prisma.service';

type Db = Prisma.TransactionClient;

/**
 * The seller order reached the customer: `delivered`, or `released` (delivered, return window
 * over). Returned, refunded or disputed orders do not count (02-trd §6.1).
 */
const DELIVERED: SellerOrderStatus[] = ['delivered', 'released'];

const PLACEMENT_RANK: Record<FeaturedBrandPlacement, number> = { top: 0, featured: 1 };

/** Home page highlights: trust counters, featured reviews and paid featured brands. */
@Injectable()
export class StorefrontService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  /**
   * products, seller_orders and ad_subscriptions have RLS, so these reads run with
   * app.role = 'public_read' (docs/b2-auth.md §5) and filter to visible rows themselves.
   */
  private publicRead<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    return this.db.withPlatformScope('public_read', fn);
  }

  async stats(): Promise<StorefrontStats> {
    const [verifiedSellers, officialBrands, products, ordersDelivered] = await this.publicRead(
      (tx) =>
        Promise.all([
          tx.seller.count({ where: LIVE_SELLER }),
          // A protected brand of a suspended manufacturer is not counted while it is hidden.
          tx.brand.count({ where: { isProtected: true, ...VISIBLE_BRAND } }),
          tx.product.count({ where: LIVE }),
          tx.sellerOrder.count({ where: { status: { in: DELIVERED } } }),
        ]),
    );
    return { verifiedSellers, officialBrands, products, ordersDelivered };
  }

  /**
   * Newest 4–5 star reviews that are published, have a quote to show, are of a live product of
   * a visible seller, and come from a verified purchase: every review hangs off a bought order
   * item, and here that seller order must also have been delivered. Reviews of deleted accounts
   * are never showcased. One quote per shopper (their newest), so a single reviewer never fills
   * the section; see FEATURED_REVIEWS_SCAN_FACTOR for the bounded window this is picked from.
   */
  async featuredReviews(limit: number): Promise<FeaturedReview[]> {
    const rows = await this.publicRead((tx) =>
      tx.review.findMany({
        where: {
          status: 'published',
          rating: { gte: FEATURED_REVIEW_MIN_RATING },
          body: { not: null },
          NOT: { body: '' },
          product: LIVE,
          orderItem: { sellerOrder: { status: { in: DELIVERED } } },
          customer: { deletedAt: null },
        },
        // Seeded demo reviews share timestamps; the product slug settles those ties the same
        // way as mock mode (packages/sdk/src/mock/home-fixtures.ts).
        orderBy: [{ createdAt: 'desc' }, { product: { slug: 'asc' } }, { id: 'desc' }],
        take: limit * FEATURED_REVIEWS_SCAN_FACTOR,
        include: {
          customer: { select: { fullName: true } },
          product: { select: { slug: true, title: true } },
        },
      }),
    );
    const shoppers = new Set<string>();
    const picked: typeof rows = [];
    for (const r of rows) {
      if (picked.length === limit) break;
      if (shoppers.has(r.customerId)) continue;
      shoppers.add(r.customerId);
      picked.push(r);
    }
    return picked.map((r) => ({
      ...toReview(r),
      product: { slug: r.product.slug, title: r.product.title },
    }));
  }

  /**
   * Brands featured by a paid package (`features.featuredBrand`: Icon "top", Luxe "yes").
   * ad_subscriptions has no brand column, so the brand is derived from the subscriber: every
   * protected (trademark-verified) brand the subscribing seller owns. The subscription must be
   * `active` inside its current period and the seller visible. "top" comes first, then by name.
   */
  async featuredBrands(): Promise<FeaturedBrand[]> {
    const candidates = await this.publicRead((tx) => this.featuredBrandCandidates(tx, new Date()));
    // One entry per brand, at its best placement.
    const byId = new Map<string, FeaturedBrand>();
    for (const { brand, placement } of candidates) {
      const seen = byId.get(brand.id);
      if (!seen || PLACEMENT_RANK[placement] < PLACEMENT_RANK[seen.placement]) {
        byId.set(brand.id, { ...toBrand(brand), placement });
      }
    }
    return [...byId.values()]
      .sort(
        (a, b) =>
          PLACEMENT_RANK[a.placement] - PLACEMENT_RANK[b.placement] ||
          a.name.localeCompare(b.name, 'en'),
      )
      .slice(0, FEATURED_BRANDS_MAX);
  }

  private async featuredBrandCandidates(tx: Db, now: Date) {
    const placementByPackage = new Map<string, FeaturedBrandPlacement>();
    for (const p of await tx.adPackage.findMany({ select: { id: true, features: true } })) {
      const level = featuredBrandLevel(p.features);
      if (level !== 'none') placementByPackage.set(p.id, level === 'top' ? 'top' : 'featured');
    }
    if (!placementByPackage.size) return [];
    const subscriptions = await tx.adSubscription.findMany({
      where: {
        packageId: { in: [...placementByPackage.keys()] },
        status: 'active',
        AND: [
          { OR: [{ currentPeriodStart: null }, { currentPeriodStart: { lte: now } }] },
          { OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }] },
        ],
        seller: LIVE_SELLER,
      },
      select: {
        packageId: true,
        seller: { select: { ownedBrands: { where: { isProtected: true } } } },
      },
    });
    return subscriptions.flatMap(({ packageId, seller }) => {
      const placement = placementByPackage.get(packageId);
      return placement ? seller.ownedBrands.map((brand) => ({ brand, placement })) : [];
    });
  }
}

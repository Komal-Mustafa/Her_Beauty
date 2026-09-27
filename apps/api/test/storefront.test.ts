import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { z } from 'zod';
import { createPrismaClient, uuidv7, type SellerOrderStatus, type SellerStatus } from '@hb/db';
import { Brand, FeaturedBrand, FeaturedReview, StorefrontStats } from '@hb/types';
import {
  featuredBrands as fixtureFeaturedBrands,
  featuredReviews as fixtureFeaturedReviews,
  storefrontStats as fixtureStats,
} from '@hb/sdk/home-fixtures';
import { Api, createTestApp, ErrorBody, hasDb } from './helpers';

/**
 * Home page highlights (docs/p4-home.md §6): GET /stats/storefront, /reviews/featured and
 * /brands/featured, against the migrated + seeded database. On the seed they must match the
 * mock adapter; then rows that must be hidden are added next to rows that must show.
 */
const DAY = 86_400_000;
const RUN = Date.now().toString(36);
const slug = (name: string) => `p4-${name}-${RUN}`;

const FeaturedReviews = z.array(FeaturedReview);
const FeaturedBrands = z.array(FeaturedBrand);

describe.skipIf(!hasDb)('storefront highlights', () => {
  let app: INestApplication;
  let api: Api;
  const db = createPrismaClient();

  beforeAll(async () => {
    ({ app } = await createTestApp());
    api = new Api(app);
  });

  afterAll(async () => {
    await removeTestRows();
    await db.$disconnect();
    await app?.close();
  });

  const stats = async () =>
    StorefrontStats.parse((await api.get('/stats/storefront').expect(200)).body);

  describe('on the seeded catalogue (same as mock mode)', () => {
    it('counts sellers, official brands, live products and delivered orders', async () => {
      const res = await api.get('/stats/storefront').expect(200);
      expect(StorefrontStats.strict().parse(res.body)).toEqual(fixtureStats);
      expect(res.headers['cache-control']).toBe('public, max-age=300');
    });

    it('features the newest 4–5 star reviews, 3 by default', async () => {
      const all = FeaturedReviews.parse(
        (await api.get('/reviews/featured?limit=12').expect(200)).body,
      );
      const shown = ({ authorName, rating, title, body, createdAt, product }: FeaturedReview) => ({
        authorName,
        rating,
        title,
        body,
        createdAt,
        product,
      });
      const dates = all.map((r) => r.createdAt);
      expect(dates).toEqual([...dates].sort().reverse());
      // Same reviews as mock mode; ties on createdAt are ordered by id, which differ there.
      const bySameKey = (list: FeaturedReview[]) =>
        list
          .map(shown)
          .sort((a, b) =>
            `${a.createdAt}|${a.product.slug}|${a.authorName}`.localeCompare(
              `${b.createdAt}|${b.product.slug}|${b.authorName}`,
            ),
          );
      expect(bySameKey(all)).toEqual(bySameKey(fixtureFeaturedReviews.slice(0, 12)));
      const byDefault = FeaturedReviews.parse(
        (await api.get('/reviews/featured').expect(200)).body,
      );
      expect(byDefault).toEqual(all.slice(0, 3));
      const one = FeaturedReviews.parse(
        (await api.get('/reviews/featured?limit=1').expect(200)).body,
      );
      expect(one).toEqual(all.slice(0, 1));
    });

    it('features the brands of Icon ("top") then Luxe ("featured") advertisers', async () => {
      const res = await api.get('/brands/featured').expect(200);
      const brands = FeaturedBrands.parse(res.body);
      expect(brands.map((b) => [b.slug, b.placement])).toEqual(
        fixtureFeaturedBrands.map((b) => [b.slug, b.placement]),
      );
      // The literal route is not swallowed by GET /brands/:slug, and brands still resolve.
      const glow = await api.get('/brands/glow').expect(200);
      expect(Brand.parse(glow.body).slug).toBe('glow');
    });

    it('rejects a bad review limit or unknown parameters', async () => {
      for (const query of ['limit=0', 'limit=13', 'limit=abc', 'limit=2.5', 'limit=', 'x=1']) {
        const res = await api.get(`/reviews/featured?${query}`).expect(400);
        expect(ErrorBody.parse(res.body).error.code, query).toBe('VALIDATION_FAILED');
      }
    });
  });

  // ---------- rows that must stay hidden, next to rows that must show ----------

  const rows = {
    users: [] as string[],
    sellers: [] as string[],
    brands: [] as string[],
    products: [] as string[],
    orders: [] as string[],
    sellerOrders: [] as string[],
    subscriptions: [] as string[],
  };

  async function removeTestRows() {
    const items = await db.orderItem.findMany({
      where: { sellerOrderId: { in: rows.sellerOrders } },
      select: { id: true },
    });
    const itemIds = items.map((i) => i.id);
    await db.review.deleteMany({ where: { orderItemId: { in: itemIds } } });
    await db.orderItem.deleteMany({ where: { id: { in: itemIds } } });
    await db.sellerOrder.deleteMany({ where: { id: { in: rows.sellerOrders } } });
    await db.order.deleteMany({ where: { id: { in: rows.orders } } });
    await db.adSubscription.deleteMany({ where: { id: { in: rows.subscriptions } } });
    await db.product.deleteMany({ where: { id: { in: rows.products } } });
    await db.brand.deleteMany({ where: { id: { in: rows.brands } } });
    await db.seller.deleteMany({ where: { id: { in: rows.sellers } } });
    await db.user.deleteMany({ where: { id: { in: rows.users } } });
  }

  async function user(fullName: string, deleted = false) {
    const id = uuidv7();
    rows.users.push(id);
    await db.user.create({
      data: {
        id,
        email: `${slug(fullName.toLowerCase().replace(/\s+/g, '-'))}@p4data.test`,
        fullName,
        deletedAt: deleted ? new Date() : null,
      },
    });
    return id;
  }

  /** A seller owning one brand, optionally with an ad subscription to `packageCode`. */
  async function seller(
    name: string,
    opts: {
      status?: SellerStatus;
      protectedBrand?: boolean;
      ad?: { packageCode: string; status?: 'active' | 'cancelled'; endsInDays?: number };
    } = {},
  ) {
    const ownerId = await user(`${name} Owner`);
    const sellerId = uuidv7();
    rows.sellers.push(sellerId);
    await db.seller.create({
      data: {
        id: sellerId,
        ownerUserId: ownerId,
        type: 'manufacturer',
        status: opts.status ?? 'approved',
        storeName: `${name} Store`,
        slug: slug(name.toLowerCase()),
      },
    });
    const brandId = uuidv7();
    rows.brands.push(brandId);
    await db.brand.create({
      data: {
        id: brandId,
        name: `P4 ${name} ${RUN}`,
        slug: slug(`${name.toLowerCase()}-brand`),
        ownerSellerId: sellerId,
        isProtected: opts.protectedBrand ?? true,
      },
    });
    if (opts.ad) {
      const pkg = await db.adPackage.findUniqueOrThrow({ where: { code: opts.ad.packageCode } });
      const endsInDays = opts.ad.endsInDays ?? 30;
      const subscriptionId = uuidv7();
      rows.subscriptions.push(subscriptionId);
      await db.adSubscription.create({
        data: {
          id: subscriptionId,
          sellerId,
          packageId: pkg.id,
          status: opts.ad.status ?? 'active',
          currentPeriodStart: new Date(Date.now() + (endsInDays - 30) * DAY),
          currentPeriodEnd: new Date(Date.now() + endsInDays * DAY),
        },
      });
    }
    return { sellerId, brandId };
  }

  async function product(sellerId: string, brandId: string, status: 'live' | 'draft') {
    const category = await db.category.findFirstOrThrow({ select: { id: true } });
    const id = uuidv7();
    const variantId = uuidv7();
    const productSlug = slug(`${status}-${id.slice(-6)}`);
    rows.products.push(id);
    await db.product.create({
      data: {
        id,
        sellerId,
        brandId,
        categoryId: category.id,
        title: `P4 test ${status} product`,
        slug: productSlug,
        status,
        variants: { create: { id: variantId, sku: `P4-${RUN}`, price: 150_000n, stock: 5 } },
      },
    });
    return { id, variantId, slug: productSlug };
  }

  type Line = {
    product: { id: string; variantId: string };
    review?: { rating: number; status?: string; body?: string | null; inDays: number };
  };

  /** One order with one seller order; each line may carry a review. Returns the review ids. */
  async function order(
    customerId: string,
    sellerId: string,
    status: SellerOrderStatus,
    lines: Line[],
  ) {
    const orderId = uuidv7();
    const sellerOrderId = uuidv7();
    const unit = 150_000n;
    const subtotal = unit * BigInt(lines.length);
    rows.orders.push(orderId);
    rows.sellerOrders.push(sellerOrderId);
    await db.order.create({
      data: {
        id: orderId,
        number: `HB-P4-${RUN}-${rows.orders.length}`,
        customerId,
        status: 'completed',
        paymentMethod: 'card',
        subtotal,
        shippingTotal: 0n,
        grandTotal: subtotal,
        addressSnapshot: { city: 'Lahore', country: 'PK' },
        contactPhone: '+923000000000',
        idempotencyKey: `p4-${RUN}-${rows.orders.length}`,
      },
    });
    await db.sellerOrder.create({
      data: {
        id: sellerOrderId,
        orderId,
        sellerId,
        status,
        subtotal,
        shippingFee: 0n,
        commissionBps: 0,
        commissionAmount: 0n,
        sellerNet: subtotal,
      },
    });
    const reviewIds: string[] = [];
    for (const line of lines) {
      const itemId = uuidv7();
      await db.orderItem.create({
        data: {
          id: itemId,
          sellerOrderId,
          variantId: line.product.variantId,
          productId: line.product.id,
          titleSnapshot: 'P4 test product',
          unitPrice: unit,
          qty: 1,
          lineTotal: unit,
        },
      });
      if (!line.review) continue;
      const reviewId = uuidv7();
      reviewIds.push(reviewId);
      await db.review.create({
        data: {
          id: reviewId,
          orderItemId: itemId,
          productId: line.product.id,
          customerId,
          rating: line.review.rating,
          title: 'P4 test review',
          body:
            line.review.body === undefined
              ? 'Seeded by the storefront highlights test.'
              : line.review.body,
          status: line.review.status ?? 'published',
          // In the future on purpose: hidden reviews would otherwise be the newest.
          createdAt: new Date(Date.now() + line.review.inDays * DAY),
        },
      });
    }
    return reviewIds;
  }

  describe('visibility rules', () => {
    let before: StorefrontStats;
    const ids = {
      shownReview: '',
      hiddenReviews: [] as string[],
      topBrand: '',
      hiddenBrands: [] as string[],
      liveSlug: '',
    };

    beforeAll(async () => {
      before = await stats();

      // Icon advertiser (approved): its protected brand is featured "top"; its second,
      // unprotected brand is not.
      const icon = await seller('Icon', { ad: { packageCode: 'icon' } });
      ids.topBrand = icon.brandId;
      const extra = uuidv7();
      rows.brands.push(extra);
      await db.brand.create({
        data: {
          id: extra,
          name: `P4 Unverified ${RUN}`,
          slug: slug('unverified'),
          ownerSellerId: icon.sellerId,
        },
      });
      ids.hiddenBrands.push(extra);
      // Luxe advertisers that must not show: suspended seller, lapsed period, cancelled plan.
      // Radiance has no featured brand at all.
      const suspended = await seller('Suspended', {
        status: 'suspended',
        ad: { packageCode: 'luxe' },
      });
      const lapsed = await seller('Lapsed', { ad: { packageCode: 'luxe', endsInDays: -1 } });
      const cancelled = await seller('Cancelled', {
        ad: { packageCode: 'luxe', status: 'cancelled' },
      });
      const basic = await seller('Basic', { ad: { packageCode: 'radiance' } });
      ids.hiddenBrands.push(suspended.brandId, lapsed.brandId, cancelled.brandId, basic.brandId);

      const live = await product(icon.sellerId, icon.brandId, 'live');
      const draft = await product(icon.sellerId, icon.brandId, 'draft');
      const ofSuspended = await product(suspended.sellerId, suspended.brandId, 'live');
      ids.liveSlug = live.slug;

      const shopper = await user('Zara Test Buyer');
      const gone = await user('Gone Buyer', true);
      const [shown = '', ...hidden] = await order(shopper, icon.sellerId, 'delivered', [
        { product: live, review: { rating: 5, inDays: 2 } },
        { product: live, review: { rating: 3, inDays: 3 } },
        { product: live, review: { rating: 5, status: 'hidden', inDays: 3 } },
        { product: live, review: { rating: 5, body: null, inDays: 3 } },
        { product: live, review: { rating: 5, body: '', inDays: 3 } },
        { product: draft, review: { rating: 5, inDays: 3 } },
      ]);
      ids.shownReview = shown;
      ids.hiddenReviews.push(
        ...hidden,
        ...(await order(shopper, suspended.sellerId, 'delivered', [
          { product: ofSuspended, review: { rating: 5, inDays: 3 } },
        ])),
        ...(await order(shopper, icon.sellerId, 'refunded', [
          { product: live, review: { rating: 5, inDays: 3 } },
        ])),
        ...(await order(gone, icon.sellerId, 'released', [
          { product: live, review: { rating: 4, inDays: 3 } },
        ])),
      );
    });

    it('counts only visible sellers, brands and products, and delivered orders', async () => {
      const after = await stats();
      expect(after).toEqual({
        verifiedSellers: before.verifiedSellers + 4, // Icon, Lapsed, Cancelled, Basic
        officialBrands: before.officialBrands + 4, // their protected brands
        products: before.products + 1, // the live product of an approved seller
        ordersDelivered: before.ordersDelivered + 3, // 2 delivered + 1 released
      });
    });

    it('features only published 4–5 star quotes of live products from delivered orders', async () => {
      const res = await api.get('/reviews/featured?limit=12').expect(200);
      const reviews = FeaturedReviews.parse(res.body);
      expect(reviews[0]?.id).toBe(ids.shownReview);
      expect(reviews[0]?.authorName).toBe('Zara T.');
      expect(reviews[0]?.product).toEqual({ slug: ids.liveSlug, title: 'P4 test live product' });
      const shownIds = reviews.map((r) => r.id);
      for (const hidden of ids.hiddenReviews) expect(shownIds).not.toContain(hidden);
      expect(reviews.every((r) => r.rating >= 4)).toBe(true);
      const dates = reviews.map((r) => r.createdAt);
      expect(dates).toEqual([...dates].sort().reverse());
    });

    it('never returns fields beyond the public types', async () => {
      const [review] = (await api.get('/reviews/featured?limit=1').expect(200)).body as Record<
        string,
        unknown
      >[];
      expect(Object.keys(review ?? {}).sort()).toEqual(Object.keys(FeaturedReview.shape).sort());
      expect(Object.keys((review?.product as object | undefined) ?? {}).sort()).toEqual([
        'slug',
        'title',
      ]);
      const [brand] = (await api.get('/brands/featured').expect(200)).body as object[];
      expect(Object.keys(brand ?? {}).sort()).toEqual(Object.keys(FeaturedBrand.shape).sort());
    });

    it('features only protected brands of approved sellers with a current Icon/Luxe plan', async () => {
      const brands = FeaturedBrands.parse((await api.get('/brands/featured').expect(200)).body);
      const mine = brands.find((b) => b.id === ids.topBrand);
      expect(mine?.placement).toBe('top');
      for (const hidden of ids.hiddenBrands) expect(brands.map((b) => b.id)).not.toContain(hidden);
      expect(new Set(brands.map((b) => b.id)).size).toBe(brands.length);
      // "top" first, then "featured"; by name inside each group.
      const top = brands.filter((b) => b.placement === 'top');
      const featured = brands.filter((b) => b.placement === 'featured');
      expect(brands).toEqual([...top, ...featured]);
      for (const group of [top, featured]) {
        const names = group.map((b) => b.name);
        expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
      }
    });
  });
});

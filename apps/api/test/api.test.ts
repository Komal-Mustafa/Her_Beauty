import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { z } from 'zod';
import { createPrismaClient, uuidv7 } from '@hb/db';
import {
  AdPackage,
  Brand,
  Category,
  HeroScene,
  Page,
  Product,
  ProductCard,
  Review,
  SellingPlan,
  ServedAd,
  Store,
} from '@hb/types';
import { products as fixtureProducts, stores as fixtureStores } from '@hb/sdk/fixtures';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';

/**
 * Integration tests: the real Nest app against a migrated + seeded Postgres
 * (`pnpm --filter @hb/db migrate:deploy && pnpm --filter @hb/db seed`).
 * Every response is checked against the shared @hb/types schema, so the
 * storefront can switch from mock data to this API without code changes.
 */
const hasDb = Boolean(process.env.DATABASE_URL);

const ErrorBody = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown() }),
});

describe.skipIf(!hasDb)('Her Beauty API (catalog + ads)', () => {
  let app: INestApplication;
  const db = createPrismaClient();
  // Rows created for visibility tests; removed in afterAll.
  const hidden = {
    userId: uuidv7(),
    sellerId: uuidv7(),
    suspendedProductId: uuidv7(),
    draftProductId: uuidv7(),
    suspendedSlug: `hidden-suspended-${Date.now()}`,
    draftSlug: `hidden-draft-${Date.now()}`,
    storeSlug: `hidden-store-${Date.now()}`,
  };

  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication({ logger: false }));
    await app.init();

    const live = await db.product.findFirstOrThrow({
      where: { status: 'live' },
      select: { sellerId: true, brandId: true, categoryId: true },
    });
    await db.user.create({
      data: {
        id: hidden.userId,
        email: `${hidden.storeSlug}@owner.test`,
        fullName: 'Suspended Owner',
        role: 'seller',
      },
    });
    await db.seller.create({
      data: {
        id: hidden.sellerId,
        ownerUserId: hidden.userId,
        type: 'vendor',
        status: 'suspended',
        storeName: 'Suspended Store',
        slug: hidden.storeSlug,
      },
    });
    const base = { brandId: live.brandId, categoryId: live.categoryId };
    await db.product.createMany({
      data: [
        // Live product, but its seller is suspended.
        {
          ...base,
          id: hidden.suspendedProductId,
          sellerId: hidden.sellerId,
          title: 'Hidden suspended',
          slug: hidden.suspendedSlug,
          status: 'live',
        },
        // Approved seller, but the product is still a draft.
        {
          ...base,
          id: hidden.draftProductId,
          sellerId: live.sellerId,
          title: 'Hidden draft',
          slug: hidden.draftSlug,
          status: 'draft',
        },
      ],
    });
  });

  afterAll(async () => {
    await db.product.deleteMany({
      where: { id: { in: [hidden.suspendedProductId, hidden.draftProductId] } },
    });
    await db.seller.deleteMany({ where: { id: hidden.sellerId } });
    await db.user.deleteMany({ where: { id: hidden.userId } });
    await db.$disconnect();
    await app?.close();
  });

  it('GET /v1/health checks the database', async () => {
    const res = await api().get('/v1/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  describe('catalog', () => {
    it('lists categories and finds one by slug', async () => {
      const res = await api().get('/v1/categories').expect(200);
      const list = z.array(Category).parse(res.body);
      expect(list.length).toBeGreaterThan(0);
      const first = list[0];
      if (!first) throw new Error('no categories');
      const one = await api().get(`/v1/categories/${first.slug}`).expect(200);
      expect(Category.parse(one.body)).toEqual(first);
    });

    it('lists brands and finds one by slug', async () => {
      const res = await api().get('/v1/brands').expect(200);
      const list = z.array(Brand).parse(res.body);
      const first = list[0];
      if (!first) throw new Error('no brands');
      const one = await api().get(`/v1/brands/${first.slug}`).expect(200);
      expect(Brand.parse(one.body)).toEqual(first);
    });

    it('serves every seeded product from the storefront catalogue', async () => {
      const res = await api().get('/v1/products?limit=100').expect(200);
      const page = Page(ProductCard).parse(res.body);
      expect(page.items.map((p) => p.slug).sort()).toEqual(
        fixtureProducts.map((p) => p.slug).sort(),
      );
      expect(page.nextCursor).toBeNull();
    });

    it('pages with an opaque cursor without gaps or repeats', async () => {
      const seen: string[] = [];
      let cursor: string | null = null;
      do {
        const url: string = `/v1/products?limit=5&sort=price_asc${cursor ? `&cursor=${cursor}` : ''}`;
        const res = await api().get(url).expect(200);
        const page = Page(ProductCard).parse(res.body);
        seen.push(...page.items.map((p) => p.slug));
        cursor = page.nextCursor;
      } while (cursor);
      expect(seen).toHaveLength(fixtureProducts.length);
      expect(new Set(seen).size).toBe(seen.length);
    });

    it('filters by category, brand, seller type and price, and sorts', async () => {
      const lips = await api().get('/v1/products?category=lips&limit=100').expect(200);
      const lipsCat = await api().get('/v1/categories/lips').expect(200);
      const lipsItems = Page(ProductCard).parse(lips.body).items;
      expect(lipsItems.length).toBeGreaterThan(0);
      expect(lipsItems.every((p) => p.categoryId === lipsCat.body.id)).toBe(true);

      const glow = await api().get('/v1/products?brand=glow&limit=100').expect(200);
      const glowItems = Page(ProductCard).parse(glow.body).items;
      expect(glowItems.length).toBeGreaterThan(0);
      expect(glowItems.every((p) => p.brand.slug === 'glow')).toBe(true);

      const makers = await api().get('/v1/products?sellerType=manufacturer&limit=100').expect(200);
      expect(
        Page(ProductCard)
          .parse(makers.body)
          .items.every((p) => p.seller.type === 'manufacturer'),
      ).toBe(true);

      const band = await api()
        .get('/v1/products?minPrice=200000&maxPrice=300000&sort=price_desc&limit=100')
        .expect(200);
      const prices = Page(ProductCard)
        .parse(band.body)
        .items.map((p) => p.price);
      expect(prices.length).toBeGreaterThan(0);
      expect(prices.every((p) => p >= 200_000 && p <= 300_000)).toBe(true);
      expect(prices).toEqual([...prices].sort((a, b) => b - a));
    });

    it('searches title, brand and store name', async () => {
      const res = await api().get('/v1/products?q=ROSE&limit=100').expect(200);
      const items = Page(ProductCard).parse(res.body).items;
      expect(items.length).toBeGreaterThan(0);
      for (const p of items) {
        expect(`${p.title} ${p.brand.name} ${p.seller.storeName}`.toLowerCase()).toContain('rose');
      }
    });

    it('labels sponsored products', async () => {
      const res = await api().get('/v1/products?limit=100').expect(200);
      const sponsored = Page(ProductCard)
        .parse(res.body)
        .items.filter((p) => p.sponsored);
      expect(sponsored.length).toBeGreaterThan(0);
    });

    it('returns product detail with variants in price then listing order', async () => {
      const res = await api().get('/v1/products/velvet-matte-lipstick').expect(200);
      const product = Product.parse(res.body);
      const fixture = fixtureProducts.find((p) => p.slug === 'velvet-matte-lipstick');
      expect(product.variants.map((v) => v.sku)).toEqual(fixture?.variants.map((v) => v.sku));
      expect(product.shades).toEqual(fixture?.shades);
      expect(product.price).toBe(Math.min(...product.variants.map((v) => v.price)));
      const model = product.media.find((m) => m.type === 'model3d');
      expect(model?.model3dKind).toBe('lipstick');
    });

    it('returns verified reviews by slug and by product id', async () => {
      const bySlug = await api().get('/v1/products/velvet-matte-lipstick/reviews').expect(200);
      const reviews = z.array(Review).parse(bySlug.body);
      expect(reviews.length).toBeGreaterThan(0);
      const product = await api().get('/v1/products/velvet-matte-lipstick').expect(200);
      const byId = await api().get(`/v1/reviews?productId=${product.body.id}`).expect(200);
      expect(byId.body).toEqual(bySlug.body);
    });

    it('lists approved stores with live product counts', async () => {
      const res = await api().get('/v1/stores').expect(200);
      const list = z.array(Store).parse(res.body);
      expect(list.map((s) => s.slug).sort()).toEqual(fixtureStores.map((s) => s.slug).sort());
      const glow = await api().get('/v1/stores/glow-cosmetics').expect(200);
      const store = Store.parse(glow.body);
      expect(store.badge).toBe('official_brand');
      expect(store.productCount).toBe(
        fixtureProducts.filter((p) => p.seller.slug === 'glow-cosmetics').length,
      );
    });
  });

  describe('visibility', () => {
    it('hides draft products and products of suspended sellers', async () => {
      await api().get(`/v1/products/${hidden.draftSlug}`).expect(404);
      await api().get(`/v1/products/${hidden.suspendedSlug}`).expect(404);
      const res = await api().get('/v1/products?limit=100').expect(200);
      const slugs = Page(ProductCard)
        .parse(res.body)
        .items.map((p) => p.slug);
      expect(slugs).not.toContain(hidden.draftSlug);
      expect(slugs).not.toContain(hidden.suspendedSlug);
    });

    it('hides suspended stores', async () => {
      await api().get(`/v1/stores/${hidden.storeSlug}`).expect(404);
      const res = await api().get('/v1/stores').expect(200);
      expect(res.body.map((s: { slug: string }) => s.slug)).not.toContain(hidden.storeSlug);
    });
  });

  describe('errors', () => {
    it('rejects unknown sort values with VALIDATION_FAILED', async () => {
      const res = await api().get('/v1/products?sort=bogus').expect(400);
      const body = ErrorBody.parse(res.body);
      expect(body.error.code).toBe('VALIDATION_FAILED');
    });

    it('rejects unknown query parameters', async () => {
      const res = await api().get('/v1/products?admin=true').expect(400);
      expect(ErrorBody.parse(res.body).error.code).toBe('VALIDATION_FAILED');
    });

    it('rejects a limit above the maximum', async () => {
      await api().get('/v1/products?limit=1000').expect(400);
    });

    it('rejects malformed slugs before touching the database', async () => {
      const res = await api().get("/v1/products/'%20OR%201=1").expect(400);
      expect(ErrorBody.parse(res.body).error.code).toBe('VALIDATION_FAILED');
    });

    it('returns NOT_FOUND for missing resources', async () => {
      for (const path of [
        '/v1/products/does-not-exist',
        '/v1/categories/does-not-exist',
        '/v1/brands/does-not-exist',
        '/v1/stores/does-not-exist',
      ]) {
        const res = await api().get(path).expect(404);
        expect(ErrorBody.parse(res.body).error.code).toBe('NOT_FOUND');
      }
    });

    it('returns an empty list for reviews of an unknown product id', async () => {
      const res = await api().get(`/v1/reviews?productId=${uuidv7()}`).expect(200);
      expect(res.body).toEqual([]);
    });

    it('sets security headers', async () => {
      const res = await api().get('/v1/health').expect(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('ads', () => {
    it('serves booked ads for each homepage slot', async () => {
      for (const slot of ['hero', 'left_3d', 'right_video', 'sponsored_product'] as const) {
        const res = await api().get(`/v1/ads/serve?slot=${slot}`).expect(200);
        const ads = z.array(ServedAd).parse(res.body);
        expect(ads.every((a) => a.slot === slot)).toBe(true);
      }
      const hero = await api().get('/v1/ads/serve?slot=hero').expect(200);
      expect(hero.body.length).toBeGreaterThan(0);
    });

    it('scopes category banners to their category', async () => {
      const eyes = await api().get('/v1/ads/serve?slot=category_banner&category=eyes').expect(200);
      const hair = await api().get('/v1/ads/serve?slot=category_banner&category=hair').expect(200);
      expect(z.array(ServedAd).parse(eyes.body)).toHaveLength(1);
      expect(hair.body).toEqual([]);
    });

    it('rejects unknown slots', async () => {
      await api().get('/v1/ads/serve?slot=popup').expect(400);
    });

    it('lists hero scenes, ad packages and selling plans', async () => {
      const hero = await api().get('/v1/cms/hero-scenes').expect(200);
      expect(z.array(HeroScene).parse(hero.body).length).toBeGreaterThan(0);

      const pkgs = await api().get('/v1/ads/packages').expect(200);
      const packages = z.array(AdPackage).parse(pkgs.body);
      expect(packages.map((p) => p.code)).toEqual(['glow', 'radiance', 'luxe', 'icon']);
      for (const p of packages) {
        if (p.seatsTotal !== null) expect(p.seatsTaken).toBeLessThanOrEqual(p.seatsTotal);
      }

      const plans = await api().get('/v1/plans').expect(200);
      expect(z.array(SellingPlan).parse(plans.body).length).toBeGreaterThan(0);
    });
  });
});

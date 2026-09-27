import { describe, expect, it } from 'vitest';
import { FeaturedBrand, FeaturedReview, StorefrontStats } from '@hb/types';
import { mockApi } from './mock-api';

describe('mockApi.getProducts', () => {
  it('filters by category slug', async () => {
    const { items } = await mockApi.getProducts({ category: 'lips' });
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((p) => p.categoryId === 'cat-lips')).toBe(true);
  });

  it('paginates with a cursor', async () => {
    const first = await mockApi.getProducts({ limit: 5 });
    expect(first.items).toHaveLength(5);
    expect(first.nextCursor).toBe('5');
    const second = await mockApi.getProducts({ limit: 5, cursor: first.nextCursor ?? undefined });
    expect(second.items[0]?.id).not.toBe(first.items[0]?.id);
  });

  it('marks sponsored products', async () => {
    const { items } = await mockApi.getProducts({ limit: 100 });
    expect(items.find((p) => p.slug === 'rose-dusk-palette')?.sponsored).toBe(true);
  });

  it('keeps prices as integer paisa', async () => {
    const { items } = await mockApi.getProducts({ limit: 100 });
    expect(items.every((p) => Number.isInteger(p.price))).toBe(true);
  });
});

describe('mockApi home highlights', () => {
  it('counts the mock catalogue for the storefront stats', async () => {
    const stats = StorefrontStats.parse(await mockApi.getStorefrontStats());
    const { items } = await mockApi.getProducts({ limit: 100 });
    const brands = await mockApi.getBrands();
    expect(stats.products).toBe(items.length);
    expect(stats.verifiedSellers).toBe((await mockApi.getStores()).length);
    expect(stats.officialBrands).toBe(brands.filter((b) => b.isProtected).length);
    expect(stats.ordersDelivered).toBeGreaterThan(0);
  });

  it('features the newest 4–5 star verified reviews, 3 by default', async () => {
    const reviews = FeaturedReview.array().parse(await mockApi.getFeaturedReviews());
    expect(reviews).toHaveLength(3);
    const all = FeaturedReview.array().parse(await mockApi.getFeaturedReviews(12));
    expect(all.every((r) => r.rating >= 4 && r.verifiedPurchase)).toBe(true);
    const dates = all.map((r) => r.createdAt);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(reviews).toEqual(all.slice(0, 3));
    for (const r of all) {
      const product = await mockApi.getProduct(r.product.slug);
      expect(product?.id).toBe(r.productId);
      expect(product?.title).toBe(r.product.title);
    }
  });

  it('clamps the review limit to 1–12 like the HTTP adapter', async () => {
    expect(await mockApi.getFeaturedReviews(0)).toHaveLength(1);
    expect(await mockApi.getFeaturedReviews(2.9)).toHaveLength(2);
    expect((await mockApi.getFeaturedReviews(500)).length).toBeLessThanOrEqual(12);
    expect(await mockApi.getFeaturedReviews(Number.NaN)).toHaveLength(3);
  });

  it('features protected brands of Icon then Luxe advertisers', async () => {
    const featured = FeaturedBrand.array().parse(await mockApi.getFeaturedBrands());
    expect(featured.map((b) => [b.slug, b.placement])).toEqual([
      ['rose-house', 'top'],
      ['glow', 'featured'],
      ['velvet', 'featured'],
    ]);
    const brands = await mockApi.getBrands();
    for (const b of featured) {
      const { placement: _placement, ...brand } = b;
      expect(brands).toContainEqual(brand);
    }
  });
});

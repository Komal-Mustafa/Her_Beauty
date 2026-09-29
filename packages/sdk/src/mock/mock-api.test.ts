import { describe, expect, it } from 'vitest';
import {
  DeliveryEstimate,
  discountPercent,
  FeaturedBrand,
  FeaturedReview,
  isOnSale,
  PK_CITIES,
  ProductCard,
  SearchResult,
  shadeFamily,
  StorefrontStats,
  type PkCity,
} from '@hb/types';
import { ApiRequestError } from '../http/http-api';
import { products, reviews, sponsoredProductSlugs } from './fixtures';
import { mockApi } from './mock-api';

const slugsOf = (list: readonly { slug: string }[]) => list.map((p) => p.slug);

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

  it('returns cards only, sponsored flags set', async () => {
    const { items } = await mockApi.getProducts({ limit: 100 });
    expect(items).toHaveLength(48);
    for (const card of items) {
      expect(Object.keys(card).sort()).toEqual(Object.keys(ProductCard.shape).sort());
      expect(card.sponsored).toBe(sponsoredProductSlugs.includes(card.slug));
    }
    expect((await mockApi.getProduct('rose-dusk-palette'))?.sponsored).toBe(true);
    expect((await mockApi.getProduct('velvet-matte-lipstick'))?.sponsored).toBe(false);
  });

  it('filters by shade family, sale and new', async () => {
    const reds = (await mockApi.getProducts({ shade: ['red'], limit: 100 })).items;
    expect(reds.length).toBeGreaterThan(0);
    expect(reds.every((p) => p.shades.some((s) => shadeFamily(s.hex) === 'red'))).toBe(true);
    const sale = (await mockApi.getProducts({ onSale: true, limit: 100 })).items;
    expect(sale).toHaveLength(products.filter(isOnSale).length);
    const fresh = (await mockApi.getProducts({ isNew: true, limit: 100 })).items;
    expect(fresh.every((p) => p.isNew)).toBe(true);
    expect(fresh).toHaveLength(products.filter((p) => p.isNew).length);
  });

  it('returns exactly the asked ids, in order, skipping unknown ones', async () => {
    const { items } = await mockApi.getProducts({ ids: ['prd-9', 'prd-404', 'prd-2', 'prd-9'] });
    expect(items.map((p) => p.id)).toEqual(['prd-9', 'prd-2']);
  });

  it('sorts by biggest discount, then cheapest', async () => {
    const { items } = await mockApi.getProducts({ sort: 'discount', limit: 100 });
    const off = items.map((p) => discountPercent(p.price, p.compareAtPrice));
    expect(off).toEqual([...off].sort((a, b) => b - a));
    expect(off[0]).toBeGreaterThan(0);
  });

  it('puts up to two sponsored products first by default, best sellers after', async () => {
    const { items } = await mockApi.getProducts({ limit: 100 });
    expect(items.slice(0, 2).every((p) => p.sponsored)).toBe(true);
    const rest = items.slice(2).map((p) => products.find((f) => f.id === p.id)?.soldCount ?? 0);
    expect(rest).toEqual([...rest].sort((a, b) => b - a));
    const explicit = await mockApi.getProducts({ sort: 'best_selling', limit: 3 });
    expect(explicit.items[0]?.slug).toBe('surmai-kohl-pencil');
  });

  it('rejects invalid queries like the API', async () => {
    await expect(mockApi.getProducts({ limit: 1000 })).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
    } satisfies Partial<ApiRequestError>);
  });
});

describe('mockApi.search', () => {
  it('pages 24 products at a time with facets', async () => {
    const first = SearchResult.parse(await mockApi.search());
    expect(first).toMatchObject({ total: 48, page: 1, pageSize: 24, pageCount: 2 });
    expect(first.items).toHaveLength(24);
    const second = await mockApi.search({ page: 2 });
    const all = [...first.items, ...second.items].map((p) => p.slug);
    expect(new Set(all).size).toBe(48);
    const past = await mockApi.search({ page: 3 });
    expect(past).toMatchObject({ items: [], total: 48, page: 3 });
  });

  it('finds lipsticks despite a typo', async () => {
    const { items } = await mockApi.search({ q: 'lipstik', pageSize: 48 });
    const lipsticks = products.filter(
      (p) => /lipstick/i.test(p.title) || p.tags.includes('lipstick'),
    );
    expect(slugsOf(items).sort()).toEqual(slugsOf(lipsticks).sort());
  });

  it('finds Lumière without the accent', async () => {
    const { items } = await mockApi.search({ q: 'lumiere', pageSize: 48 });
    const lumiere = products.filter((p) => p.brand.slug === 'lumiere');
    expect(slugsOf(items).sort()).toEqual(slugsOf(lumiere).sort());
  });

  it('needs every word: "vitamin serum" finds only products with both', async () => {
    const { items } = await mockApi.search({ q: 'vitamin serum', pageSize: 48 });
    expect(slugsOf(items)).toEqual(['vitamin-c-glow-serum']);
  });

  it('ranks Velvet brand products and Velvet Matte Lipstick first for "velvet"', async () => {
    const { items } = await mockApi.search({ q: 'velvet', pageSize: 48 });
    const top = products.filter(
      (p) => p.brand.slug === 'velvet' || p.slug === 'velvet-matte-lipstick',
    );
    // Sponsored products that match are pinned above them; none of them matches "velvet".
    expect(items.some((p) => p.sponsored)).toBe(false);
    expect(slugsOf(items.slice(0, top.length)).sort()).toEqual(slugsOf(top).sort());
  });

  it('finds nothing for "xyzzy", with empty facets', async () => {
    const result = await mockApi.search({ q: 'xyzzy' });
    expect(result).toMatchObject({ items: [], total: 0, pageCount: 0 });
    expect(result.facets.price).toBeNull();
    expect(result.facets.brands.every((b) => b.count === 0)).toBe(true);
  });

  it('pins at most two sponsored products, only without an explicit sort', async () => {
    const pinned = await mockApi.search({ pageSize: 48 });
    expect(pinned.items.slice(0, 2).every((p) => p.sponsored)).toBe(true);
    expect(pinned.items.filter((p) => p.sponsored)).toHaveLength(sponsoredProductSlugs.length);
    const sorted = await mockApi.search({ sort: 'price_asc', pageSize: 48 });
    const prices = sorted.items.map((p) => p.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    // A sponsored product found by text is pinned above better text matches.
    const serum = await mockApi.search({ q: 'serum' });
    expect(serum.items[0]?.sponsored).toBe(true);
  });

  it('never shows a pinned product twice across pages', async () => {
    const pages = await Promise.all(
      [1, 2, 3, 4, 5].map((page) => mockApi.search({ page, pageSize: 10 })),
    );
    const all = pages.flatMap((p) => slugsOf(p.items));
    expect(all).toHaveLength(48);
    expect(new Set(all).size).toBe(48);
  });

  it('keeps both brand counts when two brands are ticked', async () => {
    const one = await mockApi.search({ brand: ['glow'] });
    const two = await mockApi.search({ brand: ['glow', 'mehr'] });
    const count = (r: SearchResult, slug: string) =>
      r.facets.brands.find((b) => b.value === slug)?.count;
    expect(count(one, 'mehr')).toBe(3);
    expect(count(two, 'mehr')).toBe(3);
    expect(count(two, 'glow')).toBe(4);
    expect(two.total).toBe(7);
    // Brand counts respect the other filters.
    const lips = await mockApi.search({ brand: ['glow', 'mehr'], category: 'lips' });
    expect(count(lips, 'glow')).toBe(3);
    expect(count(lips, 'mehr')).toBe(2);
    expect(lips.total).toBe(5);
  });

  it('applies fixed page filters and reports facets for the rest', async () => {
    const store = await mockApi.search({ seller: 'chandni-glam', pageSize: 48 });
    expect(store.total).toBe(7);
    expect(store.items.every((p) => p.seller.slug === 'chandni-glam')).toBe(true);
    expect(store.facets.categories.find((c) => c.value === 'eyes')?.count).toBe(2);
    const offers = await mockApi.search({ onSale: true, sort: 'discount', pageSize: 48 });
    expect(offers.total).toBe(products.filter(isOnSale).length);
    const shades = await mockApi.search({ category: 'lips', shade: ['nude', 'red'] });
    expect(shades.items.every((p) => p.categoryId === 'cat-lips')).toBe(true);
    expect(shades.facets.shades.map((s) => s.value)).toEqual([
      'nude',
      'pink',
      'red',
      'berry',
      'coral',
      'mauve',
      'brown',
      'gold',
    ]);
  });

  it('rejects invalid queries like the API', async () => {
    for (const bad of [{ page: 0 }, { pageSize: 49 }, { sort: 'bogus' }, { shade: ['green'] }]) {
      await expect(mockApi.search(bad as never)).rejects.toBeInstanceOf(ApiRequestError);
    }
  });
});

describe('mockApi.getDeliveryEstimate', () => {
  const estimate = async (slug: string, city: PkCity) =>
    DeliveryEstimate.parse(await mockApi.getDeliveryEstimate(slug, city));

  it('estimates from the seller city and shipping profile', async () => {
    // Glow Cosmetics, Lahore: handling 1 day, lightest same-city band Rs 150, 1–2 days.
    expect(await estimate('velvet-matte-lipstick', 'Lahore')).toEqual({
      city: 'Lahore',
      zone: 'same_city',
      daysMin: 2,
      daysMax: 3,
      fee: 15_000,
      freeShippingMin: 300_000,
      codAvailable: true,
    });
    expect((await estimate('velvet-matte-lipstick', 'Islamabad')).zone).toBe('province');
    expect((await estimate('velvet-matte-lipstick', 'Karachi')).zone).toBe('nationwide');
    expect((await estimate('velvet-matte-lipstick', 'Skardu')).zone).toBe('remote');
    // Chandni Glam, Rawalpindi: Islamabad is the same city.
    expect((await estimate('surmai-kohl-pencil', 'Islamabad')).zone).toBe('same_city');
    // Rose House has no remote rate and no cash on delivery.
    expect(await estimate('damask-rose-eau-de-parfum', 'Gilgit')).toMatchObject({
      zone: 'remote',
      fee: null,
      codAvailable: false,
    });
  });

  it('answers every listed city for every seller', async () => {
    const sellers = new Map(products.map((p) => [p.seller.id, p.slug]));
    for (const slug of sellers.values()) {
      for (const { name } of PK_CITIES) {
        const e = await estimate(slug, name);
        expect(e.daysMax).toBeGreaterThanOrEqual(e.daysMin);
      }
    }
  });

  it('returns null for an unknown product and rejects an unknown city', async () => {
    expect(await mockApi.getDeliveryEstimate('does-not-exist', 'Lahore')).toBeNull();
    await expect(
      mockApi.getDeliveryEstimate('velvet-matte-lipstick', 'Dubai' as PkCity),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
  });
});

describe('mockApi.getAdSlots', () => {
  it('serves a category banner only on its product category page', async () => {
    const eyes = await mockApi.getAdSlots('category_banner', { category: 'eyes' });
    expect(eyes.map((a) => a.productSlug)).toEqual(['rose-dusk-palette']);
    expect(await mockApi.getAdSlots('category_banner', { category: 'hair' })).toEqual([]);
    expect(await mockApi.getAdSlots('category_banner')).toHaveLength(1);
    expect(await mockApi.getAdSlots('left_3d', { category: 'hair' })).toHaveLength(2);
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

  it("features each shopper's newest 4–5 star verified review, newest first", async () => {
    const all = FeaturedReview.array().parse(await mockApi.getFeaturedReviews(12));
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((r) => r.rating >= 4 && r.verifiedPurchase)).toBe(true);
    const dates = all.map((r) => r.createdAt);
    expect(dates).toEqual([...dates].sort().reverse());
    const authors = all.map((r) => r.authorName);
    expect(new Set(authors).size).toBe(authors.length);
    for (const r of all) {
      const newer = reviews.filter(
        (o) => o.authorName === r.authorName && o.rating >= 4 && o.createdAt > r.createdAt,
      );
      expect(newer).toEqual([]);
      const product = await mockApi.getProduct(r.product.slug);
      expect(product?.id).toBe(r.productId);
      expect(product?.title).toBe(r.product.title);
    }
    const byDefault = await mockApi.getFeaturedReviews();
    expect(byDefault.length).toBeLessThanOrEqual(3);
    expect(byDefault).toEqual(all.slice(0, byDefault.length));
  });

  it('clamps the review limit to 1–12 like the HTTP adapter', async () => {
    expect(await mockApi.getFeaturedReviews(0)).toHaveLength(1);
    expect(await mockApi.getFeaturedReviews(500)).toEqual(await mockApi.getFeaturedReviews(12));
    expect(await mockApi.getFeaturedReviews(Number.NaN)).toEqual(
      await mockApi.getFeaturedReviews(),
    );
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

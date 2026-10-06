import type { Brand, Category, Paged, ProductCard, ProductQuery, Store } from '@hb/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSitemap, SITEMAP_PAGE_SIZE, type SitemapApi } from './sitemap';

const BASE = 'https://herbeauty.pk';

const rows = <T>(slugs: string[], make: (slug: string) => T) => slugs.map(make);
const category = (slug: string) => ({ id: `c-${slug}`, slug, name: slug }) as Category;
const brand = (slug: string) => ({ id: `b-${slug}`, slug, name: slug }) as Brand;
const store = (slug: string) => ({ id: `s-${slug}`, slug, storeName: slug }) as Store;
const card = (slug: string) => ({ id: `p-${slug}`, slug }) as ProductCard;

/** A fake API over `count` products, paged like getProducts with an offset cursor. */
function fakeApi(count: number, over: Partial<SitemapApi> = {}): SitemapApi {
  const products = Array.from({ length: count }, (_, i) => card(`product-${i + 1}`));
  return {
    getCategories: async () => rows(['lips', 'face'], category),
    getBrands: async () => rows(['glow', 'velvet'], brand),
    getStores: async () => rows(['glow-cosmetics'], store),
    getProducts: vi.fn(async (q: ProductQuery = {}): Promise<Paged<ProductCard>> => {
      const start = Number(q.cursor ?? 0);
      const limit = q.limit ?? 24;
      const next = start + limit < products.length ? String(start + limit) : null;
      return { items: products.slice(start, start + limit), nextCursor: next };
    }),
    ...over,
  };
}

const urls = (map: { url: string }[]) => map.map((e) => e.url);
const fail = async (): Promise<never> => {
  throw new Error('API down');
};

beforeEach(() => {
  // optional() reports a failed part on stderr; keep the test output clean.
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});
afterEach(() => vi.restoreAllMocks());

describe('buildSitemap', () => {
  it('lists the fixed pages, categories, brands, stores and products as absolute URLs', async () => {
    const map = await buildSitemap(fakeApi(2), BASE);
    expect(urls(map)).toEqual([
      'https://herbeauty.pk/',
      'https://herbeauty.pk/new',
      'https://herbeauty.pk/offers',
      'https://herbeauty.pk/brands',
      'https://herbeauty.pk/category/lips',
      'https://herbeauty.pk/category/face',
      'https://herbeauty.pk/brand/glow',
      'https://herbeauty.pk/brand/velvet',
      'https://herbeauty.pk/store/glow-cosmetics',
      'https://herbeauty.pk/product/product-1',
      'https://herbeauty.pk/product/product-2',
    ]);
    expect(map[0]).toEqual({ url: 'https://herbeauty.pk/', changeFrequency: 'daily', priority: 1 });
    for (const e of map) expect(e.priority).toBeGreaterThan(0);
  });

  it('pages through every product with the largest page getProducts takes', async () => {
    const api = fakeApi(250);
    const map = await buildSitemap(api, `${BASE}/`);
    const products = urls(map).filter((u) => u.includes('/product/'));
    expect(products).toHaveLength(250);
    expect(new Set(products).size).toBe(250);
    expect(products.at(-1)).toBe('https://herbeauty.pk/product/product-250');
    expect(api.getProducts).toHaveBeenCalledTimes(3);
    expect(api.getProducts).toHaveBeenNthCalledWith(1, { limit: SITEMAP_PAGE_SIZE });
    expect(api.getProducts).toHaveBeenNthCalledWith(2, { limit: SITEMAP_PAGE_SIZE, cursor: '100' });
  });

  it('keeps the rest when one part fails, and the fixed pages when the API is down', async () => {
    const noBrands = await buildSitemap(fakeApi(1, { getBrands: fail }), BASE);
    expect(urls(noBrands).some((u) => u.includes('/brand/'))).toBe(false);
    expect(urls(noBrands)).toContain('https://herbeauty.pk/product/product-1');
    expect(urls(noBrands)).toContain('https://herbeauty.pk/category/lips');

    const down = fakeApi(0, {
      getCategories: fail,
      getBrands: fail,
      getStores: fail,
      getProducts: fail,
    });
    expect(urls(await buildSitemap(down, BASE))).toEqual([
      'https://herbeauty.pk/',
      'https://herbeauty.pk/new',
      'https://herbeauty.pk/offers',
      'https://herbeauty.pk/brands',
    ]);
    expect(process.stderr.write).toHaveBeenCalledWith(expect.stringContaining('sitemap products'));
  });

  it('stops on a cursor that does not move and skips values that are not slugs', async () => {
    const stuck = vi.fn(async () => ({
      items: [card('a'), card('a'), card('../x')],
      nextCursor: 'same',
    }));
    const map = await buildSitemap(
      fakeApi(0, { getProducts: stuck, getStores: async () => rows(['Bad Slug', 'ok'], store) }),
      BASE,
    );
    expect(stuck).toHaveBeenCalledTimes(2);
    expect(urls(map).filter((u) => u.includes('/product/'))).toEqual([
      'https://herbeauty.pk/product/a',
    ]);
    expect(urls(map).filter((u) => u.includes('/store/'))).toEqual([
      'https://herbeauty.pk/store/ok',
    ]);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { FeaturedBrand, FeaturedReview, StorefrontStats } from '@hb/types';
import type { HbApi } from '../api';
import { mockApi } from '../mock/mock-api';
import type { ApiRequestError } from './http-api';
import { createHttpApi } from './http-api';

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async (_url: string) => new Response(JSON.stringify(body), { status }));
}

describe('createHttpApi', () => {
  it('builds product query strings with arrays joined by commas', async () => {
    const f = fakeFetch(200, { items: [], nextCursor: null });
    const api = createHttpApi({ baseUrl: 'http://api.test/v1/', fetch: f });
    await api.getProducts({
      category: 'lips',
      brand: ['a', 'b'],
      minPrice: 1000,
      sort: 'price_asc',
    });
    expect(f).toHaveBeenCalledWith(
      'http://api.test/v1/products?category=lips&brand=a%2Cb&minPrice=1000&sort=price_asc',
      expect.anything(),
    );
  });

  it('returns null for a missing product instead of throwing', async () => {
    const api = createHttpApi({ baseUrl: 'http://api.test/v1', fetch: fakeFetch(404, {}) });
    await expect(api.getProduct('nope')).resolves.toBeNull();
  });

  it('calls the home highlight endpoints', async () => {
    const f = fakeFetch(200, []);
    const api = createHttpApi({ baseUrl: 'http://api.test/v1', fetch: f });
    await api.getStorefrontStats();
    await api.getFeaturedBrands();
    await api.getFeaturedReviews();
    expect(f.mock.calls.map(([url]) => url)).toEqual([
      'http://api.test/v1/stats/storefront',
      'http://api.test/v1/brands/featured',
      'http://api.test/v1/reviews/featured?limit=3',
    ]);
  });

  it('clamps the featured review limit to 1–12 before asking the API', async () => {
    const f = fakeFetch(200, []);
    const api = createHttpApi({ baseUrl: 'http://api.test/v1', fetch: f });
    for (const limit of [0, 5, 7.6, 99]) await api.getFeaturedReviews(limit);
    expect(f.mock.calls.map(([url]) => url.split('?')[1])).toEqual([
      'limit=1',
      'limit=5',
      'limit=7',
      'limit=12',
    ]);
  });

  it('returns the same shapes as the mock adapter', async () => {
    const pairs = [
      [StorefrontStats, () => mockApi.getStorefrontStats(), (a: HbApi) => a.getStorefrontStats()],
      [
        FeaturedReview.array(),
        () => mockApi.getFeaturedReviews(12),
        (a: HbApi) => a.getFeaturedReviews(12),
      ],
      [
        FeaturedBrand.array(),
        () => mockApi.getFeaturedBrands(),
        (a: HbApi) => a.getFeaturedBrands(),
      ],
    ] as const;
    for (const [schema, fromMock, call] of pairs) {
      const body = schema.parse(await fromMock());
      const api = createHttpApi({ baseUrl: 'http://api.test/v1', fetch: fakeFetch(200, body) });
      expect(schema.parse(await call(api))).toEqual(body);
    }
  });

  it('surfaces the API error code on failures', async () => {
    const api = createHttpApi({
      baseUrl: 'http://api.test/v1',
      fetch: fakeFetch(400, { error: { code: 'VALIDATION_FAILED', message: 'bad' } }),
    });
    await expect(api.getProducts({})).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
    } satisfies Partial<ApiRequestError>);
  });
});

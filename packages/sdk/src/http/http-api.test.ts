import { describe, expect, it, vi } from 'vitest';
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

  it('sends search filters as the API reads them: arrays by commas, booleans as true/false', async () => {
    const f = fakeFetch(200, {});
    const api = createHttpApi({ baseUrl: 'http://api.test/v1', fetch: f });
    await api.search({
      q: 'rose & gold',
      shade: ['red', 'berry'],
      onSale: true,
      isNew: false,
      page: 2,
      pageSize: 48,
    });
    await api.search();
    await api.getProducts({ ids: ['a', 'b'], onSale: false });
    expect(f.mock.calls.map(([url]) => url)).toEqual([
      'http://api.test/v1/search?q=rose+%26+gold&shade=red%2Cberry&onSale=true&isNew=false&page=2&pageSize=48',
      'http://api.test/v1/search',
      'http://api.test/v1/products?ids=a%2Cb&onSale=false',
    ]);
  });

  it('asks for a delivery estimate by product and city, null when the product is gone', async () => {
    const f = fakeFetch(200, { zone: 'same_city' });
    const api = createHttpApi({ baseUrl: 'http://api.test/v1', fetch: f });
    await api.getDeliveryEstimate('velvet-matte-lipstick', 'Rawalpindi');
    expect(f).toHaveBeenCalledWith(
      'http://api.test/v1/products/velvet-matte-lipstick/delivery?city=Rawalpindi',
      expect.anything(),
    );
    const gone = createHttpApi({ baseUrl: 'http://api.test/v1', fetch: fakeFetch(404, {}) });
    await expect(gone.getDeliveryEstimate('nope', 'Lahore')).resolves.toBeNull();
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

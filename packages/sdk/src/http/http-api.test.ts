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

  it('returns null for a missing product instead of throwing', async () => {
    const api = createHttpApi({ baseUrl: 'http://api.test/v1', fetch: fakeFetch(404, {}) });
    await expect(api.getProduct('nope')).resolves.toBeNull();
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

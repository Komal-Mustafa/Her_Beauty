import { afterEach, describe, expect, it, vi } from 'vitest';

/** A fresh copy of the SDK entry, since getApi() keeps one HTTP client per process. */
async function freshGetApi() {
  vi.resetModules();
  return (await import('./index')).getApi;
}

function stubFetch() {
  const f = vi.fn(async (_url: string, _init?: RequestInit) => new Response('[]'));
  vi.stubGlobal('fetch', f);
  return f;
}

const sentHeaders = (f: ReturnType<typeof stubFetch>) => f.mock.calls[0]?.[1]?.headers;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('getApi', () => {
  it('uses the mock adapter unless NEXT_PUBLIC_API_MODE is http', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_MODE', 'mock');
    const getApi = await freshGetApi();
    const { mockApi } = await import('./mock/mock-api');
    expect(getApi()).toBe(mockApi);
  });

  it("sends the storefront key from the server, so the API does not count every shopper's reads as one IP", async () => {
    vi.stubEnv('NEXT_PUBLIC_API_MODE', 'http');
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://api.test/v1');
    vi.stubEnv('STOREFRONT_API_KEY', 'storefront-key-0123456789abcdef0123');
    const f = stubFetch();
    await (await freshGetApi())().getCategories();
    expect(f.mock.calls[0]?.[0]).toBe('http://api.test/v1/categories');
    expect(sentHeaders(f)).toEqual({
      'x-hb-storefront-key': 'storefront-key-0123456789abcdef0123',
      accept: 'application/json',
    });
  });

  it('sends no key when none is set, and never from a browser', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_MODE', 'http');
    vi.stubEnv('STOREFRONT_API_KEY', '');
    let f = stubFetch();
    await (await freshGetApi())().getCategories();
    expect(sentHeaders(f)).toEqual({ accept: 'application/json' });

    vi.stubEnv('STOREFRONT_API_KEY', 'storefront-key-0123456789abcdef0123');
    vi.stubGlobal('window', {});
    f = stubFetch();
    await (await freshGetApi())().getCategories();
    expect(sentHeaders(f)).toEqual({ accept: 'application/json' });
  });
});

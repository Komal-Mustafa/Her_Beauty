import { featuredReviewLimit, type HbApi } from '../api';
import type { ProductQuery, SearchQuery } from '@hb/types';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type HttpApiOptions = {
  baseUrl: string;
  fetch?: FetchLike;
  /** Next.js data-cache hint for server components (seconds). */
  revalidate?: number;
};

/** Arrays are comma-separated, booleans `true`/`false` (docs/p5-catalog.md §3.3). */
function queryString(q: ProductQuery | SearchQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(q)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

/** HbApi backed by the NestJS REST API (02-trd §5.1). Same signatures as the mock. */
export function createHttpApi({
  baseUrl,
  fetch: f = fetch,
  revalidate = 60,
}: HttpApiOptions): HbApi {
  const base = baseUrl.replace(/\/$/, '');

  async function get<T>(path: string, opts: { nullOn404?: boolean } = {}): Promise<T> {
    const init: RequestInit & { next?: { revalidate: number } } = {
      headers: { accept: 'application/json' },
      next: { revalidate },
    };
    const res = await f(`${base}${path}`, init);
    if (res.status === 404 && opts.nullOn404) return null as T;
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: { code?: string; message?: string };
      } | null;
      throw new ApiRequestError(
        res.status,
        body?.error?.code ?? 'HTTP_ERROR',
        body?.error?.message ?? `Request failed: ${res.status}`,
      );
    }
    return (await res.json()) as T;
  }

  const enc = encodeURIComponent;
  return {
    getCategories: () => get('/categories'),
    getCategory: (slug) => get(`/categories/${enc(slug)}`, { nullOn404: true }),
    getBrands: () => get('/brands'),
    getBrand: (slug) => get(`/brands/${enc(slug)}`, { nullOn404: true }),
    getProducts: (query = {}) => get(`/products${queryString(query)}`),
    search: (query = {}) => get(`/search${queryString(query)}`),
    getProduct: (slug) => get(`/products/${enc(slug)}`, { nullOn404: true }),
    getDeliveryEstimate: (productSlug, city) =>
      get(`/products/${enc(productSlug)}/delivery?city=${enc(city)}`, { nullOn404: true }),
    getReviews: (productId) => get(`/reviews?productId=${enc(productId)}`),
    getStore: (slug) => get(`/stores/${enc(slug)}`, { nullOn404: true }),
    getStores: () => get('/stores'),
    getAdSlots: (slot, opts) =>
      get(`/ads/serve?slot=${enc(slot)}${opts?.category ? `&category=${enc(opts.category)}` : ''}`),
    getHeroScenes: () => get('/cms/hero-scenes'),
    getAdPackages: () => get('/ads/packages'),
    getSellingPlans: () => get('/plans'),
    getStorefrontStats: () => get('/stats/storefront'),
    getFeaturedReviews: (limit) => get(`/reviews/featured?limit=${featuredReviewLimit(limit)}`),
    getFeaturedBrands: () => get('/brands/featured'),
  };
}

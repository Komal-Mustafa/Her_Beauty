import type { HbApi } from '@hb/sdk';
import { Slug } from '@hb/types';
import type { MetadataRoute } from 'next';
import { optional } from '../optional';
import { absoluteUrl } from './json-ld';

/*
 * The sitemap (docs/p5-catalog.md §10): the fixed pages, then every category, brand, store and
 * product the API lists. Each listed part is optional, so with the API down the sitemap still
 * has the fixed pages (and app/sitemap.ts tries again after its revalidate period).
 */

/** What the sitemap reads. */
export type SitemapApi = Pick<HbApi, 'getCategories' | 'getBrands' | 'getStores' | 'getProducts'>;

type Entry = MetadataRoute.Sitemap[number];
type ChangeFrequency = NonNullable<Entry['changeFrequency']>;

/** Products per request: the most getProducts takes. */
export const SITEMAP_PAGE_SIZE = 100;
/** One sitemap file holds at most 50,000 URLs (sitemaps.org); products stop well before. */
const MAX_PRODUCT_PAGES = 400;

const FIXED: readonly [path: string, changeFrequency: ChangeFrequency, priority: number][] = [
  ['/', 'daily', 1],
  ['/new', 'daily', 0.8],
  ['/offers', 'daily', 0.8],
  ['/brands', 'weekly', 0.6],
];

/** Slugs come from the API; one that is not a slug would not be a page, so it is left out. */
const slugs = (rows: readonly { slug: string }[]) =>
  rows.map((r) => r.slug).filter((slug) => Slug.safeParse(slug).success);

/** Every product slug, page by page through getProducts' cursor. */
async function productSlugs(api: SitemapApi): Promise<string[]> {
  const all: string[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PRODUCT_PAGES; page++) {
    const { items, nextCursor } = await api.getProducts({ limit: SITEMAP_PAGE_SIZE, cursor });
    all.push(...slugs(items));
    if (!nextCursor || nextCursor === cursor) break;
    cursor = nextCursor;
  }
  return [...new Set(all)];
}

/** The sitemap entries with absolute URLs on `baseUrl` (SITE.url). */
export async function buildSitemap(
  api: SitemapApi,
  baseUrl: string,
): Promise<MetadataRoute.Sitemap> {
  const [categories, brands, stores, products] = await Promise.all([
    optional('sitemap categories', api.getCategories(), []),
    optional('sitemap brands', api.getBrands(), []),
    optional('sitemap stores', api.getStores(), []),
    optional('sitemap products', productSlugs(api), []),
  ]);
  const entry = (path: string, changeFrequency: ChangeFrequency, priority: number): Entry => ({
    url: absoluteUrl(path, baseUrl),
    changeFrequency,
    priority,
  });
  return [
    ...FIXED.map(([path, frequency, priority]) => entry(path, frequency, priority)),
    ...slugs(categories).map((slug) => entry(`/category/${slug}`, 'daily', 0.8)),
    ...slugs(brands).map((slug) => entry(`/brand/${slug}`, 'weekly', 0.6)),
    ...slugs(stores).map((slug) => entry(`/store/${slug}`, 'weekly', 0.6)),
    ...products.map((slug) => entry(`/product/${slug}`, 'weekly', 0.7)),
  ];
}

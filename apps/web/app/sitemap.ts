import { createHttpApi, getApi, STOREFRONT_KEY_HEADER, type HbApi } from '@hb/sdk';
import type { MetadataRoute } from 'next';
import { buildSitemap } from '@/lib/seo/sitemap';
import { SITE } from '@/lib/site';

/** Rebuilt at most hourly (docs/p5-catalog.md §10); robots.ts points crawlers here. */
export const revalidate = 3600;

/**
 * `getApi()`, but in http mode with its reads cached as long as the sitemap: the shared client's
 * 60 s hint would make Next rebuild the sitemap every minute (a fetch's revalidate lowers the
 * route's). Same base URL and storefront key as `getApi`.
 */
function sitemapApi(): HbApi {
  if (process.env.NEXT_PUBLIC_API_MODE !== 'http') return getApi();
  const key = process.env.STOREFRONT_API_KEY;
  return createHttpApi({
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/v1',
    revalidate,
    ...(key ? { headers: { [STOREFRONT_KEY_HEADER]: key } } : {}),
  });
}

/** /sitemap.xml: fixed pages, categories, brands, stores and every product (lib/seo/sitemap.ts). */
export default function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildSitemap(sitemapApi(), SITE.url);
}

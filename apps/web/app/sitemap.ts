import { getApi } from '@hb/sdk';
import type { MetadataRoute } from 'next';
import { buildSitemap } from '@/lib/seo/sitemap';
import { SITE } from '@/lib/site';

/** Rebuilt at most hourly (docs/p5-catalog.md §10); robots.ts points crawlers here. */
export const revalidate = 3600;

/** /sitemap.xml: fixed pages, categories, brands, stores and every product (lib/seo/sitemap.ts). */
export default function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildSitemap(getApi(), SITE.url);
}

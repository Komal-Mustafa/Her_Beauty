import type { Metadata } from 'next';
import { hasFilterOrSort, type ListingKind, type ListingParams } from '@/lib/listing-url';
import { SITE } from '@/lib/site';

type ListingMetadataInput = {
  kind: ListingKind | 'brands';
  /** The page's path without params. */
  path: string;
  /** The page's H1. */
  title: string;
  /** One line about the page. */
  description: string;
  params?: ListingParams;
};

/**
 * Listing SEO (docs/p5-catalog.md §2.3): title "{H1} | Her Beauty", a one-line description, the
 * canonical path plus `?page=n` from page 2. A filtered or re-sorted page, and every search page,
 * is `noindex, follow`: its products stay reachable, the page itself is not a search result.
 */
export function listingMetadata({
  kind,
  path,
  title,
  description,
  params,
}: ListingMetadataInput): Metadata {
  const page = params?.page ?? 1;
  const canonical = page > 1 ? `${path}?page=${page}` : path;
  const fullTitle = `${title} | ${SITE.name}`;
  const noindex = kind === 'search' || (params !== undefined && hasFilterOrSort(params));
  return {
    title: { absolute: fullTitle },
    description,
    alternates: { canonical },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type: 'website',
      siteName: SITE.name,
      locale: 'en_PK',
      url: canonical,
      title: fullTitle,
      description,
    },
  };
}

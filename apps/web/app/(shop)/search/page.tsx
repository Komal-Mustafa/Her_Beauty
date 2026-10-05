import { getApi } from '@hb/sdk';
import type { ProductCard } from '@hb/types';
import { Container } from '@hb/ui';
import type { Metadata } from 'next';
import { ListingHeader } from '@/components/listing/listing-header';
import { ListingLayout } from '@/components/listing/listing-layout';
import { listingMetadata } from '@/components/listing/listing-metadata';
import { listingSearch } from '@/components/listing/load-listing';
import { SearchNoResults, SearchStart } from '@/components/listing/search-states';
import {
  hasFilterOrSort,
  hasFilters,
  parseListingParams,
  type ListingParams,
} from '@/lib/listing-params';
import { optional } from '@/lib/optional';

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Trending carousel length under the start and no-results states. */
const TRENDING = 12;

/** The H1: the search text when there is one; filters alone list all products. */
function heading(listing: ListingParams): string {
  if (listing.q) return `Results for “${listing.q}”`;
  return hasFilterOrSort(listing) ? 'All products' : 'Search';
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const listing = parseListingParams('search', await searchParams);
  return listingMetadata({
    kind: 'search',
    path: '/search',
    title: heading(listing),
    description: listing.q
      ? `Products, brands and stores matching “${listing.q}” on Her Beauty.`
      : 'Search products, brands and stores on Her Beauty, Pakistan’s premium beauty marketplace.',
    params: listing,
  });
}

/** Category circles and best sellers for the start and no-results states (both optional). */
async function suggestions() {
  const api = getApi();
  const [categories, trending] = await Promise.all([
    optional('categories', api.getCategories(), []),
    optional(
      'trending',
      api.getProducts({ sort: 'best_selling', limit: TRENDING }).then((p) => p.items),
      [] as ProductCard[],
    ),
  ]);
  return { categories, trending };
}

/**
 * Search (docs/p5-catalog.md §1, §2): typo-tolerant results by relevance with every facet. No
 * text and no filters → a search box with suggestions; no results → "We couldn’t find …" with the
 * same suggestions. No breadcrumbs here, and no search page is indexed (§2.3).
 */
export default async function SearchPage({ searchParams }: PageProps) {
  const listing = parseListingParams('search', await searchParams);

  if (!listing.q && !hasFilterOrSort(listing)) {
    return (
      <Container className="pb-16 pt-8 md:pb-24 md:pt-12">
        <SearchStart {...await suggestions()} />
      </Container>
    );
  }

  const result = await listingSearch('search', listing);
  const title = heading(listing);

  if (listing.q && result.total === 0 && !hasFilters(listing)) {
    return (
      <Container className="pb-16 pt-8 md:pb-24 md:pt-12">
        <ListingHeader eyebrow="Search" title={title} total={0} className="mb-4" />
        <SearchNoResults q={listing.q} {...await suggestions()} />
      </Container>
    );
  }

  return (
    <Container className="pb-16 pt-8 md:pb-24 md:pt-12">
      <ListingLayout
        kind="search"
        path="/search"
        params={listing}
        result={result}
        header={<ListingHeader eyebrow="Search" title={title} total={result.total} />}
      />
    </Container>
  );
}

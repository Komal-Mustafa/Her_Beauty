import { getApi } from '@hb/sdk';
import { SearchQuery, type SearchResult } from '@hb/types';
import { cache } from 'react';
import { toSearchQuery, type ListingKind, type ListingParams } from '@/lib/listing-params';

/**
 * One search per request, shared by `generateMetadata` and the page (so the metadata knows how
 * many pages there are, §2.3). React `cache` keys on the arguments, and two equal query objects
 * are not the same object: the query travels as its JSON, in the fixed order `toSearchQuery`
 * builds, and is validated again on the way out.
 */
const loadSearch = cache(
  async (queryJson: string): Promise<SearchResult> =>
    getApi().search(SearchQuery.parse(JSON.parse(queryJson))),
);

/**
 * The results of a listing page: its fixed filter (`fixed`, e.g. `{ category: 'lips' }`) plus the
 * filters, sort and page from the URL (docs/p5-catalog.md §2.2).
 */
export function listingSearch(
  kind: ListingKind,
  params: ListingParams,
  fixed: SearchQuery = {},
): Promise<SearchResult> {
  return loadSearch(JSON.stringify(toSearchQuery(kind, params, fixed)));
}

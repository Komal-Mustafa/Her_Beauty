import type { SearchResult } from '@hb/types';
import { Button, buttonVariants, EmptyState } from '@hb/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { hasFilters, listingHref, type ListingKind, type ListingParams } from '@/lib/listing-url';
import { ClearFiltersButton } from './active-filters';
import { FilterPanel } from './filter-panel';
import { ListingProvider } from './listing-context';
import { ListingGrid } from './listing-grid';
import { ListingResults } from './listing-results';
import { ListingToolbar } from './listing-toolbar';
import { Pagination } from './pagination';

type ListingLayoutProps = {
  kind: ListingKind;
  /** The page's path without params, e.g. `/category/lips`. */
  path: string;
  params: ListingParams;
  result: SearchResult;
  /** The page header: H1, count and the page's extra (banner ad, brand or store header…). */
  header: ReactNode;
  /** Shown instead of the grid when nothing matches and no filter is applied. */
  empty?: ReactNode;
};

/**
 * A listing page below its breadcrumbs (docs/p5-catalog.md §2.1): from 1024 px a sticky 264 px
 * filter column beside the toolbar, grid and pagination; below that the filters open in a drawer
 * from the toolbar. Server-rendered; the filter controls, sort and cards are the client parts.
 */
export function ListingLayout({ kind, path, params, result, header, empty }: ListingLayoutProps) {
  return (
    <ListingProvider
      kind={kind}
      path={path}
      params={params}
      facets={result.facets}
      total={result.total}
    >
      {header}
      <div className="mt-8 md:mt-10 md:grid md:grid-cols-[264px_minmax(0,1fr)] md:items-start md:gap-8 lg:gap-10">
        <aside
          aria-labelledby="filters-title"
          // Scrolls on its own when taller than the window; wheel scrolling there skips Lenis.
          data-lenis-prevent
          className="hidden overscroll-contain md:sticky md:top-24 md:block md:max-h-[calc(100dvh-7rem)] md:overflow-y-auto md:pr-2"
        >
          <h2
            id="filters-title"
            className="mb-1 font-sans text-[15px] font-semibold uppercase tracking-[0.14em] text-gold-800"
          >
            Filters
          </h2>
          <FilterPanel idPrefix="sidebar" />
        </aside>

        <div className="min-w-0">
          <ListingToolbar />
          <ListingResults className="mt-6">
            <h2 className="sr-only">Products</h2>
            <Results kind={kind} path={path} params={params} result={result} empty={empty} />
            <Pagination
              path={path}
              params={params}
              pageCount={result.pageCount}
              className="mt-12 md:mt-16"
            />
          </ListingResults>
        </div>
      </div>
    </ListingProvider>
  );
}

function Results({
  path,
  params,
  result,
  empty,
}: Pick<ListingLayoutProps, 'kind' | 'path' | 'params' | 'result' | 'empty'>) {
  if (result.items.length > 0) return <ListingGrid products={result.items} />;

  if (result.total > 0) {
    // A page past the end (an old link): the results are still there, on earlier pages.
    return (
      <EmptyState
        title="There’s nothing on this page"
        body={`These results end on page ${result.pageCount}.`}
        action={
          <Button asChild>
            <Link href={listingHref(path, { ...params, page: result.pageCount })}>
              Go to page {result.pageCount}
            </Link>
          </Button>
        }
      />
    );
  }

  if (hasFilters(params)) {
    return (
      <EmptyState
        title="No products match these filters"
        body="Try removing a filter or two to see more."
        action={<ClearFiltersButton className={buttonVariants()} />}
      />
    );
  }
  return (
    empty ?? (
      <EmptyState
        title="Nothing here yet"
        body="New products arrive every week. Have a look at what just landed."
        action={
          <Button asChild>
            <Link href="/new">See new arrivals</Link>
          </Button>
        }
      />
    )
  );
}

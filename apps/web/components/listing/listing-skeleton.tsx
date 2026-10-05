import { Container, Skeleton } from '@hb/ui';

type ListingSkeletonProps = {
  /** Breadcrumbs above the header (every listing except search). */
  crumbs?: boolean;
  /** A banner-sized block under the title (brand, store and offers headers, ad banner). */
  banner?: boolean;
  label?: string;
};

/**
 * Listing page skeleton for `loading.tsx` (docs/p5-catalog.md §1): the same layout as the page in
 * blush blocks with the soft shimmer: header, filter column from 1024 px, toolbar, 8 cards.
 */
export function ListingSkeleton({
  crumbs = true,
  banner = false,
  label = 'Loading products…',
}: ListingSkeletonProps) {
  return (
    <Container className="pb-16 pt-2 md:pb-24" aria-busy="true">
      <span className="sr-only" role="status">
        {label}
      </span>
      {crumbs ? (
        <div className="flex h-11 items-center gap-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-20" />
        </div>
      ) : null}
      <div className="mt-4 flex flex-col gap-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-2/3 max-w-md md:h-14" />
        <Skeleton className="h-4 w-24" />
      </div>
      {banner ? <Skeleton className="mt-8 h-40 w-full rounded-card md:h-56" /> : null}
      <div className="mt-8 md:mt-10 md:grid md:grid-cols-[264px_minmax(0,1fr)] md:gap-8 lg:gap-10">
        <div className="hidden flex-col gap-6 md:flex">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-11 w-28 md:hidden" />
            <Skeleton className="ml-auto h-11 w-48" />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex flex-col gap-3">
                <Skeleton className="aspect-[4/5] w-full rounded-card" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Container>
  );
}

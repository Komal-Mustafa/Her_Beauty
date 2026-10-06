import { Container, Skeleton } from '@hb/ui';

type ListingSkeletonProps = {
  /** Breadcrumbs above the header (every listing except search). */
  crumbs?: boolean;
  /** A banner-sized block under the title (offers header, ad banner). */
  banner?: boolean;
  /** The page's own header: the plain title block, or the brand or store header. */
  header?: 'title' | 'brand' | 'store';
  label?: string;
};

/** Mirrors StoreHeader: banner, the logo circle overlapping it, eyebrow and name, meta, about. */
function StoreHeaderSkeleton() {
  return (
    <div className="mt-4 flex flex-col">
      <Skeleton className="aspect-[16/7] w-full rounded-card sm:aspect-[4/1]" />
      <div className="flex flex-col gap-4 px-2 sm:flex-row sm:items-start sm:gap-6 sm:px-6">
        <Skeleton className="-mt-10 h-20 w-20 shrink-0 rounded-pill border-2 border-white sm:-mt-14 sm:h-28 sm:w-28" />
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:pt-4">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-10 w-2/3 max-w-md md:h-14" />
        </div>
      </div>
      {/* The meta row wraps onto several lines on a phone, and the about text is a few lines long:
          heights from the demo stores keep the grid from jumping when the page replaces this. */}
      <div className="mt-4 flex flex-col gap-3 px-2 sm:px-6">
        <Skeleton className="h-[4.5rem] w-3/4 max-w-xl sm:h-10 lg:h-6" />
        <Skeleton className="h-[4.125rem] w-full max-w-2xl sm:h-12" />
      </div>
    </div>
  );
}

/** Mirrors BrandHeader: the logo circle, then eyebrow, name and the badge / "Sold by" row. */
function BrandHeaderSkeleton() {
  return (
    <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
      <Skeleton className="h-24 w-24 shrink-0 rounded-pill md:h-32 md:w-32" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-10 w-2/3 max-w-md md:h-14" />
        <Skeleton className="h-[4.875rem] w-64 max-w-full sm:h-[3.3rem] md:h-16" />
      </div>
    </div>
  );
}

/**
 * Listing page skeleton for `loading.tsx` (docs/p5-catalog.md §1): the same layout as the page in
 * blush blocks with the soft shimmer: header, filter column from 1024 px, toolbar, 8 cards.
 */
export function ListingSkeleton({
  crumbs = true,
  banner = false,
  header = 'title',
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
      {header === 'store' ? (
        <StoreHeaderSkeleton />
      ) : header === 'brand' ? (
        <BrandHeaderSkeleton />
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-2/3 max-w-md md:h-14" />
          <Skeleton className="h-4 w-24" />
        </div>
      )}
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

import { Container, Skeleton } from '@hb/ui';

/** Product page skeleton (docs/p5-catalog.md §1): the same grid as the page, in blush blocks. */
export default function ProductLoading() {
  return (
    <Container className="pb-16 pt-2 md:pb-24" aria-busy="true">
      <span className="sr-only" role="status">
        Loading the product…
      </span>
      <div className="flex h-11 items-center gap-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="mt-2 md:grid md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:items-start md:gap-12">
        <div>
          <Skeleton className="mb-6 hidden h-12 rounded-pill md:block" />
          <Skeleton className="aspect-[4/5] w-full rounded-card" />
        </div>
        <div className="mt-8 flex flex-col gap-6 md:mt-0">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-4/5" />
            <Skeleton className="h-5 w-40" />
          </div>
          <Skeleton className="h-7 w-32" />
          <div className="flex gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-11 w-11 rounded-pill" />
            ))}
          </div>
          <Skeleton className="h-12 w-36" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-24 w-full rounded-card" />
        </div>
      </div>
    </Container>
  );
}

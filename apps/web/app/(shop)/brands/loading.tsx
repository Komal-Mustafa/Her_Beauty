import { Container, Skeleton } from '@hb/ui';

/** /brands skeleton: title, the letter index and rows of brand cards. */
export default function BrandsLoading() {
  return (
    <Container className="pb-16 pt-2 md:pb-24" aria-busy="true">
      <span className="sr-only" role="status">
        Loading brands…
      </span>
      <div className="flex h-11 items-center gap-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="mt-4 flex flex-col gap-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-1/2 max-w-sm md:h-14" />
      </div>
      <div className="mt-12 flex flex-wrap gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-20 rounded-pill" />
        ))}
      </div>
      <div className="mt-12 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-card" />
        ))}
      </div>
    </Container>
  );
}

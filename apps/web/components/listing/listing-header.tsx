import { cn } from '@hb/ui';
import type { ReactNode } from 'react';
import { productCount } from '@/lib/listing-url';

type ListingHeaderProps = {
  eyebrow?: string;
  title: ReactNode;
  /** Products matching the page's filters; left out when there is nothing to count. */
  total?: number;
  description?: ReactNode;
  className?: string;
};

/** Page header of a listing: eyebrow, the page's H1 and the result count (docs/p5-catalog.md §2.1). */
export function ListingHeader({
  eyebrow,
  title,
  total,
  description,
  className,
}: ListingHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-2', className)}>
      {eyebrow ? <p className="eyebrow text-gold-800">{eyebrow}</p> : null}
      <h1 className="font-display text-[34px] font-semibold leading-tight text-balance text-ink-900 [overflow-wrap:anywhere] md:text-[56px]">
        {title}
      </h1>
      {description ? <p className="max-w-2xl text-ink-500">{description}</p> : null}
      {total !== undefined ? (
        <p className="text-sm tabular-nums text-ink-500">{productCount(total)}</p>
      ) : null}
    </header>
  );
}

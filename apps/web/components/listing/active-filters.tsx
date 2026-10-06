'use client';

import { cn } from '@hb/ui';
import { X } from 'lucide-react';
import { useRef, type MouseEvent, type ReactNode } from 'react';
import { activeChips, cleared, listingHref, type ListingParams } from '@/lib/listing-url';
import { SORT_SELECT_ID } from './ids';
import { useListing, type Refocus } from './listing-context';

type FilterLinkProps = {
  /** The filters after following the link. */
  to: ListingParams;
  /** Where focus goes when the link goes away with the change (see `apply`). */
  refocus?: Refocus;
  className?: string;
  children: ReactNode;
};

/**
 * A link to the same listing with other filters. A plain click applies them in place, like the
 * filter panel (transition, fade, live count); other clicks (new tab…) follow the real URL.
 */
export function FilterLink({ to, refocus, className, children }: FilterLinkProps) {
  const { path, apply } = useListing();
  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    apply(to, refocus);
  }
  return (
    <a href={listingHref(path, to)} onClick={onClick} className={className}>
      {children}
    </a>
  );
}

/** Sort, just before the chips: where focus goes when no chip is left to take it. */
const sortSelect: Refocus = () => document.getElementById(SORT_SELECT_ID);

/**
 * Active filter chips above the grid (docs/p5-catalog.md §2.1): one per applied value, each
 * removing only itself, then "Clear all". A page's fixed filter (the category of a category
 * page…) is not a param, so it never shows here. A removed chip hands focus to the chip that
 * takes its place, else the one before it; Clear all (no chip left) hands it to Sort.
 */
export function ActiveFilters({ className }: { className?: string }) {
  const { params, facets } = useListing();
  const listRef = useRef<HTMLUListElement>(null);
  const chips = activeChips(params, facets);
  if (chips.length === 0) return null;

  const afterRemoving =
    (index: number): Refocus =>
    () => {
      const left = listRef.current?.querySelectorAll('a');
      return left?.[index] ?? left?.[index - 1] ?? sortSelect();
    };

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <p className="sr-only" id="active-filters-title">
        Applied filters
      </p>
      <ul ref={listRef} aria-labelledby="active-filters-title" className="flex flex-wrap gap-2">
        {chips.map((chip, i) => (
          <li key={chip.key}>
            <FilterLink
              to={chip.without}
              refocus={afterRemoving(i)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-pill border border-pink-200 bg-pink-100 py-1 pl-3.5 pr-2.5 text-sm text-pink-700 transition-colors duration-fast hover:border-pink-600"
            >
              <span aria-hidden>{chip.label}</span>
              <X aria-hidden className="h-4 w-4 shrink-0" />
              <span className="sr-only">Remove filter {chip.name}</span>
            </FilterLink>
          </li>
        ))}
      </ul>
      <FilterLink
        to={cleared(params)}
        refocus={sortSelect}
        className="inline-flex min-h-11 items-center rounded-pill px-3 text-sm font-medium text-ink-900 underline underline-offset-4 transition-colors duration-fast hover:text-pink-700"
      >
        <span aria-hidden>Clear all</span>
        <span className="sr-only">Clear all filters</span>
      </FilterLink>
    </div>
  );
}

/** The CTA of the "No products match these filters" state. */
export function ClearFiltersButton({ className }: { className?: string }) {
  const { params } = useListing();
  return (
    <FilterLink to={cleared(params)} refocus={sortSelect} className={className}>
      Clear filters
    </FilterLink>
  );
}

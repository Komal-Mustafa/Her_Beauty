'use client';

import type { ProductSort } from '@hb/types';
import { cn } from '@hb/ui';
import { ChevronDown } from 'lucide-react';
import {
  defaultSort,
  listingSearchParams,
  SORT_LABEL,
  sortOptions,
  withChange,
} from '@/lib/listing-url';
import { useListing } from './listing-context';

/**
 * Native "Sort by" select (docs/p5-catalog.md §2.1). Choosing applies at once and goes back to
 * page 1; choosing the page's default order removes `sort` from the URL. Without JavaScript the
 * small form around it submits with its button, keeping the filters.
 */
export function SortSelect({ id, className }: { id: string; className?: string }) {
  const { kind, path, params, apply } = useListing();
  const fallback = defaultSort(kind, params.q);
  const options = sortOptions(kind, params.q);
  const keep = [...listingSearchParams({ ...params, sort: undefined, page: 1 }).entries()];

  function onChange(value: string) {
    const sort = options.find((o) => o === value);
    if (!sort) return;
    apply(withChange(params, { sort: sort === fallback ? undefined : (sort as ProductSort) }));
  }

  return (
    <form action={path} method="get" className={cn('flex items-center gap-2', className)}>
      {keep.map(([key, value], i) => (
        <input key={`${key}-${i}`} type="hidden" name={key} value={value} />
      ))}
      <label htmlFor={id} className="shrink-0 whitespace-nowrap text-sm text-ink-500">
        Sort by
      </label>
      {/* Shrinks on a 360 px phone so Filters and Sort share one row. */}
      <span className="relative min-w-0">
        <select
          id={id}
          name="sort"
          value={params.sort ?? fallback}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-full min-w-0 cursor-pointer appearance-none truncate rounded-btn border border-ink-200 bg-white pl-3 pr-9 text-sm font-medium text-ink-900 transition duration-fast hover:border-pink-600 focus:border-pink-600 focus:outline-none focus:ring-4 focus:ring-pink-100"
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {SORT_LABEL[o]}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gold-600"
        />
      </span>
      <noscript>
        <button
          type="submit"
          className="h-11 rounded-btn border border-pink-600 px-3 text-sm font-medium text-pink-600"
        >
          Sort
        </button>
      </noscript>
    </form>
  );
}

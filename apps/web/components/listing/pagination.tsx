import { cn } from '@hb/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { listingHref, type ListingParams } from '@/lib/listing-url';

/** A page number, or a gap of hidden pages. */
export type PageItem = number | 'gap';

/**
 * Pages to show: the first, the last, and the current one with a neighbour on each side; a single
 * hidden page is shown instead of a gap ("1 2 3", never "1 … 3").
 */
export function pageWindow(current: number, count: number): PageItem[] {
  if (count < 1) return [];
  const pages = new Set([1, count, current - 1, current, current + 1]);
  const sorted = [...pages].filter((n) => n >= 1 && n <= count).sort((a, b) => a - b);
  const items: PageItem[] = [];
  let previous = 0;
  for (const n of sorted) {
    if (n - previous === 2) items.push(n - 1);
    else if (n - previous > 2) items.push('gap');
    items.push(n);
    previous = n;
  }
  return items;
}

/** "2" on screen, "Page 2" when read out (one text, so no stray spaces in the name). */
function PageLabel({ page }: { page: number }) {
  return (
    <>
      <span aria-hidden>{page}</span>
      <span className="sr-only">Page {page}</span>
    </>
  );
}

type PaginationProps = {
  path: string;
  params: ListingParams;
  pageCount: number;
  className?: string;
};

const cell =
  'inline-flex h-11 min-w-11 items-center justify-center rounded-pill px-3 text-sm font-medium tabular-nums';
const link = `${cell} text-ink-900 transition-colors duration-fast hover:bg-blush-50 hover:text-pink-700`;

/**
 * Numbered pages (docs/p5-catalog.md §2.1): plain links, so pages work without JavaScript, can be
 * shared and are crawlable. Previous and Next are not links on the first and last page.
 */
export function Pagination({ path, params, pageCount, className }: PaginationProps) {
  if (pageCount <= 1) return null;
  const current = Math.min(params.page, pageCount);
  const href = (page: number) => listingHref(path, { ...params, page });

  const step = (page: number, label: 'Previous' | 'Next') => {
    const icon =
      label === 'Previous' ? (
        <ChevronLeft aria-hidden className="h-4 w-4" />
      ) : (
        <ChevronRight aria-hidden className="h-4 w-4" />
      );
    const content = (
      <>
        {label === 'Previous' ? icon : null}
        {/* Arrows alone on phones; the word is still read out. */}
        <span className="max-sm:sr-only">{label}</span>
        {label === 'Next' ? icon : null}
      </>
    );
    // A disabled link: no href, so it cannot be focused or followed, and it says it is unavailable.
    return page < 1 || page > pageCount ? (
      <span role="link" aria-disabled="true" className={cn(cell, 'gap-1 text-ink-500 opacity-60')}>
        {content}
      </span>
    ) : (
      <Link
        href={href(page)}
        rel={label === 'Previous' ? 'prev' : 'next'}
        className={cn(link, 'gap-1')}
      >
        {content}
      </Link>
    );
  };

  return (
    <nav aria-label="Pagination" className={cn('flex justify-center', className)}>
      <ul className="flex flex-wrap items-center justify-center gap-1">
        <li>{step(current - 1, 'Previous')}</li>
        {pageWindow(current, pageCount).map((item, i) =>
          item === 'gap' ? (
            <li key={`gap-${i}`} aria-hidden className={cn(cell, 'min-w-6 px-0 text-ink-500')}>
              …
            </li>
          ) : (
            <li key={item}>
              {item === current ? (
                <span
                  aria-current="page"
                  className={cn(cell, 'bg-pink-600 text-white shadow-soft')}
                >
                  <PageLabel page={item} />
                </span>
              ) : (
                <Link href={href(item)} className={link}>
                  <PageLabel page={item} />
                </Link>
              )}
            </li>
          ),
        )}
        <li>{step(current + 1, 'Next')}</li>
      </ul>
    </nav>
  );
}

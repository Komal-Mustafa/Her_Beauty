import { cn } from '@hb/ui';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { Crumb } from '@/lib/seo/json-ld';

/**
 * Breadcrumb trail (docs/p5-catalog.md §1): an ordered list in a `nav` named "Breadcrumb", the
 * last item is the current page (`aria-current`, not a link). The same `Crumb`s feed the
 * BreadcrumbList JSON-LD. A long last item is cut with an ellipsis; the page's h1 has it in full.
 */
export function Breadcrumbs({ items, className }: { items: readonly Crumb[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0 text-sm', className)}>
      <ol className="flex min-w-0 items-center">
        {items.map((crumb, i) => {
          const last = i === items.length - 1;
          return (
            <li key={crumb.href} className={cn('flex items-center', last && 'min-w-0')}>
              {i > 0 ? (
                <ChevronRight aria-hidden className="mx-1 h-4 w-4 shrink-0 text-gold-600" />
              ) : null}
              {last ? (
                <span aria-current="page" className="truncate text-ink-900">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  // At least 44 × 44 px to tap (docs/p5-catalog.md §9), however short the name.
                  className="inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap text-ink-500 underline-offset-4 transition-colors duration-fast hover:text-pink-700 hover:underline"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

'use client';

import { cn } from '@hb/ui';
import type { ReactNode } from 'react';
import { useListing } from './listing-context';

/**
 * The results area (grid, empty state, pagination). While a filter or sort change loads it fades
 * to 60 % and is marked busy (docs/p5-catalog.md §2.1); the cards stay where they are.
 */
export function ListingResults({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { pending } = useListing();
  return (
    <div
      aria-busy={pending || undefined}
      className={cn(
        'transition-opacity duration-base ease-soft',
        pending ? 'opacity-60' : 'opacity-100',
        className,
      )}
    >
      {children}
    </div>
  );
}

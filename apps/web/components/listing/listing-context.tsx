'use client';

import type { ProductFacets } from '@hb/types';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { listingHref, productCount, type ListingKind, type ListingParams } from '@/lib/listing-url';

type ListingState = {
  kind: ListingKind;
  /** The page's path without params, e.g. `/category/lips`. */
  path: string;
  /** The URL's filters; while a change is on its way, already the new ones. */
  params: ListingParams;
  facets: ProductFacets;
  /** Products matching the filters (all pages). */
  total: number;
  /** A filter or sort change is loading. */
  pending: boolean;
  /** Applies new filters at once: a history entry, no scroll jump. */
  apply: (next: ListingParams) => void;
};

const ListingContext = createContext<ListingState | null>(null);

export function useListing(): ListingState {
  const state = useContext(ListingContext);
  if (!state) throw new Error('useListing needs a ListingProvider');
  return state;
}

type ListingProviderProps = {
  kind: ListingKind;
  path: string;
  params: ListingParams;
  facets: ProductFacets;
  total: number;
  children: ReactNode;
};

/**
 * Filter state of a listing page (docs/p5-catalog.md §2.1 "Filters apply at once"). A change
 * pushes the new URL in a transition: the controls show the new values straight away
 * (`useOptimistic`), the results fade while the server renders them, and a polite live region
 * then reads out the new count. The URL stays the source of truth, so Back restores the filters.
 */
export function ListingProvider({
  kind,
  path,
  params,
  facets,
  total,
  children,
}: ListingProviderProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(params);
  const [announcement, setAnnouncement] = useState('');
  const changed = useRef(false);

  const apply = useCallback(
    (next: ListingParams) => {
      changed.current = true;
      // Emptied first, so the same count is announced again after the change.
      setAnnouncement('');
      startTransition(() => {
        setOptimistic(next);
        router.push(listingHref(path, next), { scroll: false });
      });
    },
    [path, router, setOptimistic],
  );

  useEffect(() => {
    if (pending || !changed.current) return;
    changed.current = false;
    setAnnouncement(productCount(total));
  }, [pending, total]);

  const value = useMemo(
    () => ({ kind, path, params: optimistic, facets, total, pending, apply }),
    [kind, path, optimistic, facets, total, pending, apply],
  );

  return (
    <ListingContext.Provider value={value}>
      {children}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </ListingContext.Provider>
  );
}

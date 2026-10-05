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
  /** The result count to read out after a change ("6 products"), or empty. */
  announcement: string;
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
 * then reads out the new count. The URL stays the source of truth, so Back restores the filters
 * (and the count is read out again, never left at the one before).
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
  // The filters and sort the count was last read out for (the page number does not change it).
  const shownKey = listingHref(path, { ...params, page: 1 });
  const announcedKey = useRef(shownKey);

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

  // Back and Forward change the filters without `apply`: the old count goes at once, the new one
  // is read out when its results show (below).
  useEffect(() => {
    const onHistory = () => setAnnouncement('');
    window.addEventListener('popstate', onHistory);
    return () => window.removeEventListener('popstate', onHistory);
  }, []);

  useEffect(() => {
    if (pending) return;
    if (!changed.current && announcedKey.current === shownKey) return;
    changed.current = false;
    announcedKey.current = shownKey;
    setAnnouncement(productCount(total));
  }, [pending, shownKey, total]);

  const value = useMemo(
    () => ({ kind, path, params: optimistic, facets, total, pending, announcement, apply }),
    [kind, path, optimistic, facets, total, pending, announcement, apply],
  );

  return (
    <ListingContext.Provider value={value}>
      {children}
      <ListingStatus />
    </ListingContext.Provider>
  );
}

/**
 * The polite live region with the result count. The page has one; the filter drawer adds its own
 * while open, because a modal dialog hides the rest of the page from assistive tech, this region
 * included. `fresh` regions (the drawer's) start empty and only read out counts that arrive after
 * they appear, never an older one.
 */
export function ListingStatus({ fresh = false }: { fresh?: boolean }) {
  const { announcement } = useListing();
  const [first] = useState(announcement);
  const [live, setLive] = useState(!fresh);
  if (!live && announcement !== first) setLive(true);
  return (
    <p role="status" className="sr-only">
      {live ? announcement : ''}
    </p>
  );
}

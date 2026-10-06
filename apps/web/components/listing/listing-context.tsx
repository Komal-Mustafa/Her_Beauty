'use client';

import type { ProductFacets } from '@hb/types';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
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
  /**
   * Applies new filters at once: a history entry, no scroll jump. `refocus` names where focus goes
   * when the control that made the change goes away with it (a removed chip, Clear all).
   */
  apply: (next: ListingParams, refocus?: Refocus) => void;
};

/** The element to focus once the control that applied a change is gone (null: none). */
export type Refocus = () => HTMLElement | null | undefined;

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
  const refocus = useRef<Refocus | null>(null);
  // Where the window was scrolled when the change was applied (null: no change on its way).
  const scrollFrom = useRef<number | null>(null);
  // The filters and sort the count was last read out for (the page number does not change it).
  const shownKey = listingHref(path, { ...params, page: 1 });
  const announcedKey = useRef(shownKey);

  const apply = useCallback(
    (next: ListingParams, then?: Refocus) => {
      changed.current = true;
      refocus.current = then ?? null;
      scrollFrom.current = window.scrollY;
      // Emptied first, so the same count is announced again after the change.
      setAnnouncement('');
      const href = listingHref(path, next);
      startTransition(() => {
        setOptimistic(next);
        // Next 15.5 serves a same-path URL with other search params from the page's own
        // param-less prefetch entry ("aliased"), and that path drops `scroll: false`: the window
        // jumped to the top on every change. Prefetching this exact URL first gives the push an
        // entry of its own, so the option holds; the push reuses that request, it sends no other.
        router.prefetch(href);
        router.push(href, { scroll: false });
      });
    },
    [path, router, setOptimistic],
  );

  // A control that removes itself (a chip, Clear all) leaves focus on the page's body: it goes to
  // `refocus` instead once that control is gone (WCAG 2.4.3). The empty state's Clear filters only
  // goes when the new results show, so the request waits for the change to land, no longer.
  useLayoutEffect(() => {
    const target = refocus.current;
    if (!target) return;
    const active = document.activeElement;
    if (active && active !== document.body) {
      if (!pending) refocus.current = null;
      return;
    }
    refocus.current = null;
    target()?.focus();
    // Focus may scroll its target into view: that is where the window now stays.
    if (scrollFrom.current !== null) scrollFrom.current = window.scrollY;
  });

  // The prefetch in `apply` cannot help when the new URL has no search params but the page was
  // loaded with some: Next then reuses the page's own entry and still jumps to the top, in the
  // commit that shows the results, after this effect. A microtask runs after that commit and
  // before the next frame: it puts the window back, so the jump is never painted.
  useLayoutEffect(() => {
    const from = scrollFrom.current;
    if (pending || from === null) return;
    scrollFrom.current = null;
    if (from === 0) return;
    queueMicrotask(() => {
      if (window.scrollY === 0) window.scrollTo({ top: from, behavior: 'instant' });
    });
  }, [pending]);

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

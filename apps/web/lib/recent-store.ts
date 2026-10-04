import { useSyncExternalStore } from 'react';
import * as z from 'zod/mini';
import { createLocalStore } from './local-store';
import { StoredId, StoredSlug } from './store-schemas';

/*
 * Recently viewed products (docs/p5-catalog.md §5 carousels), newest first, per browser. Keeps
 * ids and slugs only: the carousel loads current cards by id through the API, which drops hidden
 * or unknown products, so a stale entry never shows.
 */

export const RECENT_STORAGE_KEY = 'hb_recent_v1';
/** Cards the "Recently viewed" carousel shows at most. */
export const MAX_RECENT = 12;
/** One more than shown, so the product being viewed can be left out and twelve still remain. */
const MAX_STORED = MAX_RECENT + 1;

export const RecentItem = z.object({ productId: StoredId, productSlug: StoredSlug });
export type RecentItem = z.infer<typeof RecentItem>;

const EMPTY: readonly RecentItem[] = Object.freeze([]);

/** Moves (or adds) the product to the front; the oldest drop off past the limit. */
export function addRecent(items: readonly RecentItem[], item: RecentItem): readonly RecentItem[] {
  if (items[0]?.productId === item.productId && items[0].productSlug === item.productSlug) {
    return items;
  }
  return [item, ...items.filter((i) => i.productId !== item.productId)].slice(0, MAX_STORED);
}

/** What the carousel shows on a product page: every other product, newest first. */
export function recentExcept(
  items: readonly RecentItem[],
  productId: string | null,
  limit = MAX_RECENT,
): readonly RecentItem[] {
  return items.filter((i) => i.productId !== productId).slice(0, limit);
}

/** Stored JSON is untrusted: invalid entries and repeats are dropped. */
export function parseRecent(value: unknown): readonly RecentItem[] {
  if (!Array.isArray(value)) return EMPTY;
  const items: RecentItem[] = [];
  for (const raw of value.slice(0, MAX_STORED)) {
    const parsed = RecentItem.safeParse(raw);
    if (parsed.success && !items.some((i) => i.productId === parsed.data.productId)) {
      items.push(parsed.data);
    }
  }
  return items.length ? items : EMPTY;
}

const store = createLocalStore<readonly RecentItem[]>({
  key: RECENT_STORAGE_KEY,
  empty: EMPTY,
  parse: parseRecent,
});

/** Newest first; empty on the server and during hydration. */
export function useRecentlyViewed(): readonly RecentItem[] {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}

/** Call once per product page view. Invalid input is ignored. */
export function recordProductView(item: RecentItem): void {
  const parsed = RecentItem.safeParse(item);
  if (!parsed.success) return;
  store.update((items) => addRecent(items, parsed.data));
}

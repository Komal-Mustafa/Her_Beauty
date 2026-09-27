import { useCallback, useSyncExternalStore } from 'react';
import * as z from 'zod/mini';
import { createLocalStore } from './local-store';
import { StoredId, StoredSlug } from './store-schemas';

/*
 * Client wishlist until the account wishlist API exists (docs/p4-home.md §4). Newest first.
 * Keeps ids and slugs only; the wishlist page loads current product data by slug.
 */

export const WISHLIST_STORAGE_KEY = 'hb_wishlist_v1';
export const MAX_WISHLIST = 200;

export const WishlistItem = z.object({ productId: StoredId, productSlug: StoredSlug });
export type WishlistItem = z.infer<typeof WishlistItem>;

const EMPTY: readonly WishlistItem[] = Object.freeze([]);

export function hasItem(items: readonly WishlistItem[], productId: string): boolean {
  return items.some((i) => i.productId === productId);
}

/** Removes the product if saved, otherwise saves it first (oldest drop off past the limit). */
export function toggleItem(
  items: readonly WishlistItem[],
  item: WishlistItem,
): readonly WishlistItem[] {
  if (hasItem(items, item.productId)) return items.filter((i) => i.productId !== item.productId);
  return [item, ...items].slice(0, MAX_WISHLIST);
}

/** Stored JSON is untrusted: invalid entries and repeats are dropped. */
export function parseWishlist(value: unknown): readonly WishlistItem[] {
  if (!Array.isArray(value)) return EMPTY;
  const items: WishlistItem[] = [];
  for (const raw of value.slice(0, MAX_WISHLIST)) {
    const parsed = WishlistItem.safeParse(raw);
    if (parsed.success && !hasItem(items, parsed.data.productId)) items.push(parsed.data);
  }
  return items.length ? items : EMPTY;
}

const store = createLocalStore<readonly WishlistItem[]>({
  key: WISHLIST_STORAGE_KEY,
  empty: EMPTY,
  parse: parseWishlist,
});

export function useWishlist(): readonly WishlistItem[] {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}

/** Whether one product is saved; false on the server and during hydration. */
export function useIsWishlisted(productId: string): boolean {
  const snapshot = useCallback(() => hasItem(store.getSnapshot(), productId), [productId]);
  return useSyncExternalStore(store.subscribe, snapshot, serverFalse);
}

const serverFalse = () => false;

/** Returns whether the product is saved afterwards. */
export function toggleWishlist(item: WishlistItem): boolean {
  const parsed = WishlistItem.safeParse(item);
  if (!parsed.success) return false;
  store.update((items) => toggleItem(items, parsed.data));
  return hasItem(store.getSnapshot(), item.productId);
}

export function removeFromWishlist(productId: string): void {
  store.update((items) =>
    hasItem(items, productId) ? items.filter((i) => i.productId !== productId) : items,
  );
}

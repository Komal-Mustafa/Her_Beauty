import { useSyncExternalStore } from 'react';
import * as z from 'zod/mini';
import { createLocalStore } from './local-store';
import { StoredId, StoredMoney, StoredSlug } from './store-schemas';

/*
 * Client cart until the cart API exists (docs/p4-home.md §4). P6 swaps the storage for the API
 * and keeps these exports. Money is integer paisa (rules.md §1.2); prices here are for display
 * only, the server prices every order again at checkout.
 */

export const CART_STORAGE_KEY = 'hb_cart_v1';
export const MIN_QTY = 1;
export const MAX_QTY = 10;
/** More distinct items than this is not a real basket; it also bounds what we keep in storage. */
export const MAX_LINES = 50;

/** Stands in for this site's origin when resolving a stored path. */
const SAME_SITE = 'http://same-site.invalid';

/**
 * Only same-site paths or https URLs from storage ever reach an <img>. Judged by how a browser
 * resolves the value, not by its first characters: `/\host/x` and `/<tab>/host/x` start with one
 * slash, yet load from another host over plain http.
 */
function isSafeImageUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value, SAME_SITE);
  } catch {
    return false;
  }
  if (value.startsWith('/')) return url.origin === SAME_SITE;
  return value.startsWith('https://') && url.protocol === 'https:';
}

const ImageUrl = z.string().check(z.maxLength(2048), z.refine(isSafeImageUrl));

export const CartLine = z.object({
  variantId: StoredId,
  productSlug: StoredSlug,
  title: z.string().check(z.minLength(1), z.maxLength(200)),
  image: ImageUrl,
  unitPrice: StoredMoney,
  qty: z.int().check(z.gte(MIN_QTY), z.lte(MAX_QTY)),
});
export type CartLine = z.infer<typeof CartLine>;
export type NewCartLine = Omit<CartLine, 'qty'> & { qty?: number };
/** `max-qty`: already 10 of this variant. `full`: already 50 different items. */
export type AddToCartResult = 'added' | 'max-qty' | 'full' | 'invalid';

const EMPTY: readonly CartLine[] = Object.freeze([]);

export function clampQty(qty: number): number {
  if (!Number.isFinite(qty)) return MIN_QTY;
  return Math.min(MAX_QTY, Math.max(MIN_QTY, Math.trunc(qty)));
}

/** Adds a line, or raises the quantity of the same variant (clamped to 1–10). */
export function addLine(lines: readonly CartLine[], line: CartLine): readonly CartLine[] {
  const existing = lines.find((l) => l.variantId === line.variantId);
  if (!existing) return lines.length >= MAX_LINES ? lines : [...lines, line];
  const qty = clampQty(existing.qty + line.qty);
  if (qty === existing.qty) return lines;
  return lines.map((l) => (l === existing ? { ...l, qty } : l));
}

export function setLineQty(
  lines: readonly CartLine[],
  variantId: string,
  qty: number,
): readonly CartLine[] {
  const next = clampQty(qty);
  const line = lines.find((l) => l.variantId === variantId);
  if (!line || line.qty === next) return lines;
  return lines.map((l) => (l === line ? { ...l, qty: next } : l));
}

export function removeLine(lines: readonly CartLine[], variantId: string): readonly CartLine[] {
  return lines.some((l) => l.variantId === variantId)
    ? lines.filter((l) => l.variantId !== variantId)
    : lines;
}

/** Stored JSON is untrusted: invalid lines are dropped, repeated variants merged. */
export function parseCart(value: unknown): readonly CartLine[] {
  if (!Array.isArray(value)) return EMPTY;
  let lines: readonly CartLine[] = EMPTY;
  for (const raw of value.slice(0, MAX_LINES)) {
    const parsed = CartLine.safeParse(raw);
    if (parsed.success) lines = addLine(lines, parsed.data);
  }
  return lines;
}

export function cartCount(lines: readonly CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.qty, 0);
}

/** Integer paisa. */
export function cartSubtotal(lines: readonly CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
}

const store = createLocalStore<readonly CartLine[]>({
  key: CART_STORAGE_KEY,
  empty: EMPTY,
  parse: parseCart,
});

const countSnapshot = () => cartCount(store.getSnapshot());
const serverCount = () => 0;

export function useCart(): readonly CartLine[] {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}

/** Total quantity; 0 on the server and during hydration. */
export function useCartCount(): number {
  return useSyncExternalStore(store.subscribe, countSnapshot, serverCount);
}

export function addToCart(input: NewCartLine): AddToCartResult {
  const parsed = CartLine.safeParse({ ...input, qty: clampQty(input.qty ?? 1) });
  if (!parsed.success) return 'invalid';
  const before = store.getSnapshot();
  store.update((lines) => addLine(lines, parsed.data));
  if (store.getSnapshot() !== before) return 'added';
  // Unchanged: a limit held.
  return before.some((l) => l.variantId === parsed.data.variantId) ? 'max-qty' : 'full';
}

/** Current total quantity outside React (e.g. to tell a hydration update from a real add). */
export function getCartCount(): number {
  return countSnapshot();
}

export function setCartQty(variantId: string, qty: number): void {
  store.update((lines) => setLineQty(lines, variantId, qty));
}

export function removeFromCart(variantId: string): void {
  store.update((lines) => removeLine(lines, variantId));
}

export function clearCart(): void {
  store.update((lines) => (lines.length ? EMPTY : lines));
}

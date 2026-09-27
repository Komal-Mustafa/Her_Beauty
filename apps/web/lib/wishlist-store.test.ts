import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeWindow } from './test-window';
import {
  hasItem,
  MAX_WISHLIST,
  parseWishlist,
  toggleItem,
  WISHLIST_STORAGE_KEY,
  type WishlistItem,
} from './wishlist-store';

const item = (n: number): WishlistItem => ({ productId: `prd-${n}`, productSlug: `product-${n}` });

describe('wishlist items (pure)', () => {
  it('saves newest first and removes on a second toggle', () => {
    let items = toggleItem([], item(1));
    items = toggleItem(items, item(2));
    expect(items.map((i) => i.productId)).toEqual(['prd-2', 'prd-1']);
    items = toggleItem(items, item(1));
    expect(items).toEqual([item(2)]);
    expect(hasItem(items, 'prd-1')).toBe(false);
  });

  it('drops the oldest past the limit', () => {
    const full = Array.from({ length: MAX_WISHLIST }, (_, i) => item(i));
    const next = toggleItem(full, item(999));
    expect(next).toHaveLength(MAX_WISHLIST);
    expect(next[0]).toEqual(item(999));
    expect(hasItem(next, `prd-${MAX_WISHLIST - 1}`)).toBe(false);
  });

  it('drops invalid and repeated stored entries', () => {
    expect(
      parseWishlist([
        item(1),
        item(1),
        { productId: '', productSlug: 'x' },
        { productId: 'prd-9', productSlug: 'Not A Slug' },
        'prd-3',
        item(2),
      ]),
    ).toEqual([item(1), item(2)]);
    expect(parseWishlist({})).toEqual([]);
  });
});

describe('wishlist store', () => {
  let env: ReturnType<typeof fakeWindow>;
  beforeEach(() => {
    vi.resetModules();
    env = fakeWindow();
    vi.stubGlobal('window', env.win);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('toggles, persists under hb_wishlist_v1 and returns the new state', async () => {
    const wishlist = await import('./wishlist-store');
    expect(wishlist.toggleWishlist(item(1))).toBe(true);
    expect(JSON.parse(env.data.get(WISHLIST_STORAGE_KEY) ?? '[]')).toEqual([item(1)]);
    expect(wishlist.toggleWishlist(item(1))).toBe(false);
    expect(JSON.parse(env.data.get(WISHLIST_STORAGE_KEY) ?? '')).toEqual([]);
  });

  it('refuses invalid items', async () => {
    const wishlist = await import('./wishlist-store');
    expect(wishlist.toggleWishlist({ productId: 'prd-1', productSlug: '<script>' })).toBe(false);
    expect(env.data.has(WISHLIST_STORAGE_KEY)).toBe(false);
  });

  it('renders "not saved" on the server even when saved', async () => {
    env.data.set(WISHLIST_STORAGE_KEY, JSON.stringify([item(1)]));
    const wishlist = await import('./wishlist-store');
    const Heart = () => createElement('span', null, String(wishlist.useIsWishlisted('prd-1')));
    expect(renderToString(createElement(Heart))).toBe('<span>false</span>');
  });
});

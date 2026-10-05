import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addRecent,
  MAX_RECENT,
  parseRecent,
  RECENT_STORAGE_KEY,
  recentExcept,
  type RecentItem,
} from './recent-store';
import { fakeWindow } from './test-window';

const item = (n: number): RecentItem => ({ productId: `prd-${n}`, productSlug: `product-${n}` });
const ids = (items: readonly RecentItem[]) => items.map((i) => i.productId);

describe('recently viewed (pure)', () => {
  it('puts the latest view first and never repeats a product', () => {
    let items = addRecent([], item(1));
    items = addRecent(items, item(2));
    items = addRecent(items, item(1));
    expect(ids(items)).toEqual(['prd-1', 'prd-2']);
  });

  it('returns the same list when the product is already first', () => {
    const items = addRecent(addRecent([], item(2)), item(1));
    expect(addRecent(items, item(1))).toBe(items);
  });

  it('keeps enough to show twelve others while one of them is open', () => {
    let items: readonly RecentItem[] = [];
    for (let n = 1; n <= 20; n++) items = addRecent(items, item(n));
    const shown = recentExcept(items, 'prd-20');
    expect(shown).toHaveLength(MAX_RECENT);
    expect(ids(shown)[0]).toBe('prd-19');
    expect(recentExcept(items, null)).toHaveLength(MAX_RECENT);
  });

  it('drops invalid and repeated stored entries', () => {
    expect(
      parseRecent([
        item(1),
        item(1),
        { productId: '', productSlug: 'x' },
        { productId: 'prd-9', productSlug: '../../etc' },
        { productId: 'x'.repeat(101), productSlug: 'ok' },
        42,
        item(2),
      ]),
    ).toEqual([item(1), item(2)]);
    expect(parseRecent('prd-1')).toEqual([]);
  });
});

describe('recently viewed store', () => {
  let env: ReturnType<typeof fakeWindow>;
  beforeEach(() => {
    vi.resetModules();
    env = fakeWindow();
    vi.stubGlobal('window', env.win);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('records views under hb_recent_v1, newest first', async () => {
    const recent = await import('./recent-store');
    recent.recordProductView(item(1));
    recent.recordProductView(item(2));
    expect(JSON.parse(env.data.get(RECENT_STORAGE_KEY) ?? '[]')).toEqual([item(2), item(1)]);
  });

  it('ignores invalid input', async () => {
    const recent = await import('./recent-store');
    recent.recordProductView({ productId: 'prd-1', productSlug: '<img onerror=x>' });
    expect(env.data.has(RECENT_STORAGE_KEY)).toBe(false);
  });

  it('renders an empty list on the server whatever is stored', async () => {
    env.data.set(RECENT_STORAGE_KEY, JSON.stringify([item(1)]));
    const recent = await import('./recent-store');
    const List = () => createElement('span', null, recent.useRecentlyViewed().length);
    expect(renderToString(createElement(List))).toBe('<span>0</span>');
  });
});

// @vitest-environment jsdom
import type { ProductCard } from '@hb/types';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RECENT_STORAGE_KEY, type RecentItem } from '@/lib/recent-store';
import { lipstick } from './test-product';

type LoadCards = (ids: string[]) => Promise<ProductCard[]>;

const item = (n: number): RecentItem => ({ productId: `prd-${n}`, productSlug: `product-${n}` });

/** A card for product n (built from the test lipstick). */
function card(n: number): ProductCard {
  const {
    descriptionHtml: _d,
    howToUse: _h,
    ingredients: _i,
    skinTypes: _s,
    tags: _t,
    variants: _v,
    media: _m,
    soldCount: _c,
    ...base
  } = lipstick();
  return { ...base, id: `prd-${n}`, slug: `product-${n}`, title: `Product ${n}` };
}

/** Cards for the asked ids, in the asked order (as getProducts({ ids }) answers). */
const fromIds: LoadCards = async (ids) => ids.map((id) => card(Number(id.slice(4))));

/** A fresh page (new stores) for product `current`, after `stored` views (newest first). */
async function renderRecent(current: number, stored: RecentItem[], loadCards: LoadCards) {
  window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(stored));
  vi.resetModules();
  // After resetModules, the provider comes from the same fresh @hb/ui as the cards' useToast.
  const [{ ToastProvider }, { RecentlyViewed }, { RecordProductView }] = await Promise.all([
    import('@hb/ui'),
    import('./recently-viewed'),
    import('./record-view'),
  ]);
  render(
    <ToastProvider>
      <div data-testid="page">
        <RecordProductView productId={`prd-${current}`} productSlug={`product-${current}`} />
        <RecentlyViewed productId={`prd-${current}`} loadCards={loadCards} />
      </div>
    </ToastProvider>,
  );
  await act(async () => {});
  return screen.getByTestId('page');
}

const titles = () =>
  within(screen.getByRole('region', { name: 'Recently viewed' }))
    .getAllByRole('heading', { level: 3 })
    .map((h) => h.textContent);

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe('RecentlyViewed', () => {
  it('shows the other viewed products, newest first, without the one on show', async () => {
    const loadCards = vi.fn(fromIds);
    await renderRecent(4, [item(3), item(2), item(1)], loadCards);
    expect(loadCards).toHaveBeenCalledTimes(1);
    expect(loadCards).toHaveBeenCalledWith(['prd-3', 'prd-2', 'prd-1']);
    expect(titles()).toEqual(['Product 3', 'Product 2', 'Product 1']);
    // This view is recorded first in the history, still left out of its own row.
    const stored = JSON.parse(window.localStorage.getItem(RECENT_STORAGE_KEY) ?? '[]');
    expect(stored.map((i: RecentItem) => i.productId)).toEqual([
      'prd-4',
      'prd-3',
      'prd-2',
      'prd-1',
    ]);
  });

  it('leaves out the product on show wherever it is in the history', async () => {
    const loadCards = vi.fn(fromIds);
    await renderRecent(2, [item(3), item(2), item(1)], loadCards);
    expect(loadCards).toHaveBeenCalledWith(['prd-3', 'prd-1']);
    expect(titles()).toEqual(['Product 3', 'Product 1']);
  });

  it('asks for at most 12', async () => {
    const loadCards = vi.fn(fromIds);
    const stored = Array.from({ length: 13 }, (_, i) => item(20 - i));
    await renderRecent(1, stored, loadCards);
    expect(loadCards.mock.calls[0]?.[0]).toHaveLength(12);
    expect(loadCards.mock.calls[0]?.[0][0]).toBe('prd-20');
  });

  it('renders nothing without another viewed product', async () => {
    const loadCards = vi.fn(fromIds);
    const first = await renderRecent(1, [], loadCards);
    expect(first.innerHTML).toBe('');
    cleanup();
    const again = await renderRecent(1, [item(1)], loadCards);
    expect(again.innerHTML).toBe('');
    expect(loadCards).not.toHaveBeenCalled();
  });

  it('renders nothing when none of them is on sale any more, or the load fails', async () => {
    const empty = await renderRecent(2, [item(1)], async () => []);
    expect(empty.innerHTML).toBe('');
    cleanup();
    const failed = await renderRecent(2, [item(1)], () => Promise.reject(new Error('offline')));
    expect(failed.innerHTML).toBe('');
  });

  it('ignores invalid stored entries', async () => {
    const loadCards = vi.fn(fromIds);
    window.localStorage.setItem(RECENT_STORAGE_KEY, 'not json');
    await renderRecent(2, [{ productId: '', productSlug: 'x' } as RecentItem, item(1)], loadCards);
    expect(loadCards).toHaveBeenCalledWith(['prd-1']);
  });
});

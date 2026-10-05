// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_LISTING, type ListingParams } from '@/lib/listing-url';
import { FilterPanel } from './filter-panel';
import { ListingProvider } from './listing-context';
import { FACETS, params } from './test-listing';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

beforeEach(() => push.mockClear());
afterEach(cleanup);

/** A category listing as the server renders it: these params, this many results. */
function Listing({ params: p, total }: { params: ListingParams; total: number }) {
  return (
    <ListingProvider kind="category" path="/category/lips" params={p} facets={FACETS} total={total}>
      <FilterPanel idPrefix="t" />
    </ListingProvider>
  );
}

const status = () => screen.getByRole('status').textContent;

describe('ListingProvider live region', () => {
  it('says nothing on first load', () => {
    render(<Listing params={params()} total={6} />);
    expect(status()).toBe('');
  });

  it('announces the count after a change', async () => {
    render(<Listing params={params()} total={6} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: /^Glow, 4 products$/ }));
    });
    expect(status()).toBe('6 products');
  });

  it('announces the new count when the Back button restores other filters', async () => {
    const view = render(<Listing params={params({ brand: ['glow'] })} total={1} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: /^Mehr, 6 products$/ }));
    });
    expect(status()).toBe('1 product');

    // Back: the filters and the results come from history, without going through `apply`.
    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate'));
      view.rerender(<Listing params={{ ...EMPTY_LISTING }} total={6} />);
    });
    expect(status()).toBe('6 products');
  });

  it('says nothing when only the page changes', async () => {
    const view = render(<Listing params={params({ brand: ['glow'] })} total={30} />);
    await act(async () => {
      view.rerender(<Listing params={params({ brand: ['glow'], page: 2 })} total={30} />);
    });
    expect(status()).toBe('');
  });
});

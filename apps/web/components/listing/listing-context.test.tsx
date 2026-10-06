// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { use, useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_LISTING, type ListingParams } from '@/lib/listing-url';
import { ActiveFilters, ClearFiltersButton } from './active-filters';
import { FilterPanel } from './filter-panel';
import { SORT_SELECT_ID } from './ids';
import { ListingProvider } from './listing-context';
import { SortSelect } from './sort-select';
import { FACETS, params } from './test-listing';

const router = vi.hoisted(() => ({ push: vi.fn(), prefetch: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

beforeEach(() => {
  router.push.mockReset();
  router.prefetch.mockReset();
});
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

describe('ListingProvider navigation', () => {
  it('prefetches the exact URL, then pushes it without scrolling', async () => {
    render(<Listing params={params({ sort: 'newest' })} total={6} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: /^Glow, 4 products$/ }));
    });
    // The exact-URL prefetch keeps Next 15.5 from reusing the page's param-less entry, which
    // ignores `scroll: false` and jumps to the top.
    expect(router.prefetch).toHaveBeenCalledWith('/category/lips?brand=glow&sort=newest');
    expect(router.push).toHaveBeenCalledWith('/category/lips?brand=glow&sort=newest', {
      scroll: false,
    });
    expect(router.prefetch.mock.invocationCallOrder[0]).toBeLessThan(
      router.push.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('puts the window back if the router still jumps to the top', async () => {
    // Next does so for a URL without search params when the page was loaded with some.
    let y = 500;
    const scrollY = Object.getOwnPropertyDescriptor(window, 'scrollY');
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => y });
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(((
      options: ScrollToOptions,
    ) => {
      y = options.top ?? y;
    }) as typeof window.scrollTo);
    router.push.mockImplementation(() => {
      y = 0;
    });
    try {
      render(<Listing params={params({ sale: true })} total={2} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('switch', { name: /^On sale only/ }));
      });
      expect(router.push).toHaveBeenCalledWith('/category/lips', { scroll: false });
      expect(scrollTo).toHaveBeenCalledWith({ top: 500, behavior: 'instant' });
      expect(y).toBe(500);
    } finally {
      scrollTo.mockRestore();
      if (scrollY) Object.defineProperty(window, 'scrollY', scrollY);
    }
  });
});

describe('ListingProvider focused filter after a change', () => {
  // jsdom has no layout and no scrollIntoView: the call is what matters.
  const scrollIntoView = vi.fn();
  beforeEach(() => {
    scrollIntoView.mockReset();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: scrollIntoView,
    });
  });
  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  });

  it('scrolls the label of the focused filter back into view once the results land', async () => {
    render(<Listing params={params()} total={6} />);
    const glow = screen.getByRole<HTMLInputElement>('checkbox', { name: /^Glow, 4 products$/ });
    glow.focus();
    await act(async () => {
      fireEvent.click(glow);
    });
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(glow.labels?.[0]);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'instant' });
  });

  it('leaves the page alone when focus is not in the filters', async () => {
    render(
      <ListingProvider
        kind="category"
        path="/category/lips"
        params={params()}
        facets={FACETS}
        total={6}
      >
        <SortSelect id={SORT_SELECT_ID} />
        <FilterPanel idPrefix="t" />
      </ListingProvider>,
    );
    const sort = screen.getByRole('combobox');
    sort.focus();
    await act(async () => {
      fireEvent.change(sort, { target: { value: 'newest' } });
    });
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});

/**
 * The router as Next drives it: a push renders the new route in the transition, which waits
 * (stays pending) until the server answers.
 */
let navigate: ((answer: Promise<void>) => void) | undefined;
function Route() {
  const [answer, setAnswer] = useState<Promise<void>>();
  useEffect(() => {
    navigate = setAnswer;
  }, []);
  if (answer) use(answer);
  return null;
}

/** The toolbar and the results: the empty state's Clear filters when nothing matches. */
function Page({ params: p, total }: { params: ListingParams; total: number }) {
  return (
    <ListingProvider kind="category" path="/category/lips" params={p} facets={FACETS} total={total}>
      <SortSelect id={SORT_SELECT_ID} />
      <ActiveFilters />
      {total === 0 ? <ClearFiltersButton /> : <p>Results</p>}
      <Route />
    </ListingProvider>
  );
}

const link = (name: string) => screen.getByRole('link', { name });

/** Activates a link from the keyboard's point of view: focused, then followed. */
async function follow(name: string) {
  const target = link(name);
  target.focus();
  await act(async () => fireEvent.click(target));
  return target;
}

describe('ListingProvider focus after a change', () => {
  it('a removed chip hands focus to the chip that takes its place', async () => {
    const view = render(
      <Page params={params({ brand: ['glow', 'velvet'], sale: true })} total={6} />,
    );
    await follow('Remove filter Brand: Glow');
    expect(document.activeElement).toBe(link('Remove filter Brand: Velvet'));
    await act(async () =>
      view.rerender(<Page params={params({ brand: ['velvet'], sale: true })} total={3} />),
    );
    expect(document.activeElement).toBe(link('Remove filter Brand: Velvet'));
  });

  it('the last chip hands focus to the one before it', async () => {
    render(<Page params={params({ brand: ['glow'], sale: true })} total={6} />);
    await follow('Remove filter On sale');
    expect(document.activeElement).toBe(link('Remove filter Brand: Glow'));
  });

  it('Clear all, with no chip left, hands focus to Sort', async () => {
    render(<Page params={params({ brand: ['glow'], sale: true })} total={6} />);
    await follow('Clear all filters');
    expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'Sort by' }));
  });

  it("the empty state's Clear filters hands focus to Sort once the results replace it", async () => {
    let answer = () => {};
    router.push.mockImplementation(() =>
      navigate?.(new Promise<void>((resolve) => (answer = resolve))),
    );
    const view = render(<Page params={params({ brand: ['glow'] })} total={0} />);
    const clear = await follow('Clear filters');
    // Loading: the link is still there and keeps focus.
    expect(document.activeElement).toBe(clear);
    await act(async () => {
      view.rerender(<Page params={params()} total={6} />);
      answer();
    });
    expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'Sort by' }));
  });

  it('leaves focus alone when the control stays', async () => {
    render(<Page params={params({ brand: ['glow'] })} total={6} />);
    const sort = screen.getByRole('combobox', { name: 'Sort by' });
    sort.focus();
    await act(async () => fireEvent.change(sort, { target: { value: 'newest' } }));
    expect(document.activeElement).toBe(sort);
  });
});

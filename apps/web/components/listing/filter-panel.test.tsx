// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SHADE_FAMILY_HEX } from '@hb/types';
import { ActiveFilters } from './active-filters';
import { swatchMarkClass } from './filter-group';
import { FilterPanel } from './filter-panel';
import { SortSelect } from './sort-select';
import { params, renderListing } from './test-listing';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, prefetch: vi.fn() }) }));

beforeEach(() => push.mockClear());
afterEach(cleanup);

/** The URL the last change navigated to (filters apply with no scroll jump). */
function pushed(): string {
  const call = push.mock.calls.at(-1);
  expect(call?.[1]).toEqual({ scroll: false });
  return call?.[0] as string;
}

const box = (name: RegExp) => screen.getByRole('checkbox', { name });

describe('FilterPanel', () => {
  it('ticking a brand applies it at once and goes back to page 1', () => {
    renderListing(<FilterPanel idPrefix="t" />, { params: params({ page: 3 }) });
    fireEvent.click(box(/^Glow, 4 products$/));
    expect(pushed()).toBe('/category/lips?brand=glow');
  });

  it('adds a second brand to the first', () => {
    renderListing(<FilterPanel idPrefix="t" />, { params: params({ brand: ['glow'] }) });
    expect((box(/^Glow, 4 products$/) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(box(/^Mehr, 6 products$/));
    expect(pushed()).toBe('/category/lips?brand=glow&brand=mehr');
  });

  it('ticks a shade swatch by its visible name, keeping the other filters', () => {
    renderListing(<FilterPanel idPrefix="t" />, {
      params: params({ brand: ['glow'], sort: 'newest', page: 2 }),
    });
    const red = box(/^Red, 3 products$/);
    expect(red.closest('label')?.textContent).toContain('Red');
    fireEvent.click(red);
    expect(pushed()).toBe('/category/lips?brand=glow&shade=red&sort=newest');
  });

  it('marks a ticked swatch in ink on light families and in white on dark ones (3:1)', () => {
    // White has under 3:1 on gold (2.1) and nude (2.8); ink-900 has 7.8 and 5.8 there.
    const marks = Object.fromEntries(
      Object.entries(SHADE_FAMILY_HEX).map(([family, hex]) => [family, swatchMarkClass(hex)]),
    );
    expect(marks).toEqual({
      nude: 'text-ink-900',
      pink: 'text-ink-900',
      red: 'text-white',
      berry: 'text-white',
      coral: 'text-ink-900',
      mauve: 'text-ink-900',
      brown: 'text-white',
      gold: 'text-ink-900',
    });
    renderListing(<FilterPanel idPrefix="t" />, { params: params({ shade: ['nude', 'red'] }) });
    const mark = (name: RegExp) => box(name).closest('label')?.querySelector('svg');
    expect(mark(/^Nude, 5 products$/)?.getAttribute('class')).toContain('text-ink-900');
    expect(mark(/^Red, 3 products$/)?.getAttribute('class')).toContain('text-white');
  });

  it('picks a rating with a radio, and "Any rating" removes it', () => {
    const { unmount } = renderListing(<FilterPanel idPrefix="t" />, {
      params: params({ page: 4 }),
    });
    fireEvent.click(screen.getByRole('radio', { name: '4 stars & up, 5 products' }));
    expect(pushed()).toBe('/category/lips?rating=4');
    unmount();

    renderListing(<FilterPanel idPrefix="t" />, { params: params({ rating: 4, sale: true }) });
    fireEvent.click(screen.getByRole('radio', { name: 'Any rating' }));
    expect(pushed()).toBe('/category/lips?sale=1');
  });

  it('switches "On sale only" on', () => {
    renderListing(<FilterPanel idPrefix="t" />);
    fireEvent.click(screen.getByRole('switch', { name: 'On sale only, 2 products' }));
    expect(pushed()).toBe('/category/lips?sale=1');
  });

  it('picks a category on the search page, keeping the search text', () => {
    renderListing(<FilterPanel idPrefix="t" />, {
      kind: 'search',
      path: '/search',
      params: params({ q: 'lip' }),
    });
    fireEvent.click(screen.getByRole('radio', { name: 'Eyes, 2 products' }));
    expect(pushed()).toBe('/search?q=lip&category=eyes');
  });

  it('applies a price in rupees with the Apply button', () => {
    renderListing(<FilterPanel idPrefix="t" />, { params: params({ page: 2 }) });
    const min = screen.getByLabelText('Min (Rs)') as HTMLInputElement;
    const max = screen.getByLabelText('Max (Rs)') as HTMLInputElement;
    // Placeholders: the cheapest (rounded down) and dearest (rounded up) price in rupees.
    expect(min.placeholder).toBe('650');
    expect(max.placeholder).toBe('12000');
    expect(min.inputMode).toBe('numeric');
    fireEvent.change(min, { target: { value: '1000' } });
    fireEvent.change(max, { target: { value: '2,500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply price' }));
    expect(pushed()).toBe('/category/lips?min=1000&max=2500');
  });

  it('refuses a price that is not whole rupees and says so out loud', () => {
    renderListing(<FilterPanel idPrefix="t" />);
    const min = screen.getByLabelText('Min (Rs)');
    fireEvent.change(min, { target: { value: '12.50' } });
    fireEvent.keyDown(min, { key: 'Enter' });
    expect(push).not.toHaveBeenCalled();
    expect(min.getAttribute('aria-invalid')).toBe('true');
    // An alert, because focus stays on the Apply button (WCAG 4.1.3).
    const error = screen.getByRole('alert');
    expect(error.textContent).toBe('Enter whole rupees, like 1500.');
    expect(min.getAttribute('aria-describedby')).toBe(error.id);

    // Pressing Apply again with the same mistake renders a new alert, so it is read out again.
    fireEvent.click(screen.getByRole('button', { name: 'Apply price' }));
    expect(screen.getByRole('alert')).not.toBe(error);
  });

  it('hides options without products unless ticked, and groups without options', () => {
    renderListing(<FilterPanel idPrefix="t" />, { params: params({ shade: ['gold'] }) });
    expect(screen.queryByRole('checkbox', { name: /^Zero Brand/ })).toBeNull();
    // Ticked, so it stays to be unticked.
    expect(box(/^Gold, 0 products$/)).toBeTruthy();
    // Every skin type is at 0: no Skin type group at all.
    expect(screen.queryByRole('group', { name: 'Skin type' })).toBeNull();
    // A category page has no category group (the category is fixed).
    expect(screen.queryByRole('group', { name: 'Category' })).toBeNull();
  });

  it('shows 8 brands, then all of them on "Show all"', () => {
    renderListing(<FilterPanel idPrefix="t" />, { params: params({ brand: ['velvet'] }) });
    const brands = screen.getByRole('group', { name: 'Brand' });
    // 8 + the ticked brand from further down the list.
    expect(within(brands).getAllByRole('checkbox')).toHaveLength(9);
    const more = within(brands).getByRole('button', { name: 'Show all 11 brands' });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(more);
    expect(within(brands).getAllByRole('checkbox')).toHaveLength(11);
    expect(more.textContent).toBe('Show fewer');
  });

  it('folds a group with its legend button', () => {
    renderListing(<FilterPanel idPrefix="t" />);
    const toggle = screen.getByRole('button', { name: 'Shade' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('checkbox', { name: /^Red/ })).toBeNull();
  });

  it('announces the count politely once a change has loaded', async () => {
    renderListing(<FilterPanel idPrefix="t" />, { total: 6 });
    const status = screen.getByRole('status');
    expect(status.textContent).toBe('');
    await act(async () => {
      fireEvent.click(box(/^Glow, 4 products$/));
    });
    expect(status.textContent).toBe('6 products');
  });
});

describe('ActiveFilters', () => {
  it('shows one chip per value; a chip removes only its own value', () => {
    renderListing(<ActiveFilters />, {
      params: params({ brand: ['glow', 'velvet'], sale: true, page: 2 }),
    });
    const chips = screen.getAllByRole('link', { name: /^Remove filter/ });
    expect(chips.map((c) => c.textContent)).toEqual([
      'Brand: GlowRemove filter Brand: Glow',
      'Brand: VelvetRemove filter Brand: Velvet',
      'On saleRemove filter On sale',
    ]);
    fireEvent.click(chips[0]!);
    expect(pushed()).toBe('/category/lips?brand=velvet&sale=1');
    // Still a real link for a new tab or no JavaScript.
    expect(chips[1]!.getAttribute('href')).toBe('/category/lips?brand=glow&sale=1');
  });

  it('Clear all keeps the fixed filter (the page) and the sort', () => {
    renderListing(<ActiveFilters />, {
      params: params({ shade: ['red'], rating: 4, sort: 'price_asc' }),
    });
    fireEvent.click(screen.getByRole('link', { name: 'Clear all filters' }));
    expect(pushed()).toBe('/category/lips?sort=price_asc');
  });

  it('Clear all on a search keeps the search text', () => {
    renderListing(<ActiveFilters />, {
      kind: 'search',
      path: '/search',
      params: params({ q: 'serum', category: 'skincare', type: 'vendor' }),
    });
    expect(screen.getByRole('link', { name: 'Remove filter Category: skincare' })).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Clear all filters' }));
    expect(pushed()).toBe('/search?q=serum');
  });

  it('a modified click follows the link instead', () => {
    renderListing(<ActiveFilters />, { params: params({ brand: ['glow'] }) });
    // The browser would open the link; jsdom cannot, so the test stops it after the chip's handler.
    let followed = false;
    const stop = (event: MouseEvent) => {
      followed = !event.defaultPrevented;
      event.preventDefault();
    };
    document.addEventListener('click', stop);
    fireEvent.click(screen.getByRole('link', { name: 'Remove filter Brand: Glow' }), {
      ctrlKey: true,
    });
    document.removeEventListener('click', stop);
    expect(followed).toBe(true);
    expect(push).not.toHaveBeenCalled();
  });

  it('renders nothing without filters', () => {
    const { container } = renderListing(<ActiveFilters />, { params: params({ sort: 'rating' }) });
    expect(container.querySelector('a')).toBeNull();
  });
});

describe('SortSelect', () => {
  it('applies a sort and goes back to page 1; the default order drops the param', () => {
    renderListing(<SortSelect id="s" />, { params: params({ brand: ['glow'], page: 3 }) });
    const select = screen.getByRole('combobox', { name: 'Sort by' }) as HTMLSelectElement;
    expect(select.value).toBe('best_selling');
    expect([...select.options].map((o) => o.textContent)).toEqual([
      'Bestselling',
      'Newest',
      'Price: low to high',
      'Price: high to low',
      'Top rated',
      'Biggest discount',
    ]);
    fireEvent.change(select, { target: { value: 'price_desc' } });
    expect(pushed()).toBe('/category/lips?brand=glow&sort=price_desc');
  });

  it('offers Relevance first on a search with text', () => {
    renderListing(<SortSelect id="s" />, {
      kind: 'search',
      path: '/search',
      params: params({ q: 'serum', sort: 'rating' }),
    });
    const select = screen.getByRole('combobox', { name: 'Sort by' }) as HTMLSelectElement;
    expect(select.options[0]?.textContent).toBe('Relevance');
    fireEvent.change(select, { target: { value: 'relevance' } });
    expect(pushed()).toBe('/search?q=serum');
  });
});

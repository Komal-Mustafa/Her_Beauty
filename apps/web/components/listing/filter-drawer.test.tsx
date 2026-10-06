// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FilterDrawer } from './filter-drawer';
import { FILTERS_HEADING_ID } from './ids';
import { params, renderListing } from './test-listing';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, prefetch: vi.fn() }) }));

/** A phone-width window that can be widened past 1024 px. */
const media = { matches: false, listeners: new Set<() => void>() };
beforeEach(() => {
  media.matches = false;
  media.listeners.clear();
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query === '(min-width: 64rem)' && media.matches;
    },
    addEventListener: (_: string, fn: () => void) => media.listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => media.listeners.delete(fn),
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** The sidebar heading beside the drawer, as the listing layout renders it from 1024 px. */
function Drawer() {
  return (
    <>
      <h2 id={FILTERS_HEADING_ID} tabIndex={-1}>
        Filters
      </h2>
      <FilterDrawer />
    </>
  );
}

/** The Filters button as a shopper reaches it: focused, then pressed. */
async function open() {
  const button = screen.getByRole('button', { name: /^Filters/ });
  button.focus();
  await act(async () => fireEvent.click(button));
  return { button, dialog: screen.getByRole('dialog', { name: 'Filters' }) };
}

describe('FilterDrawer', () => {
  it('says how many filters are applied', () => {
    renderListing(<FilterDrawer />, { params: params({ brand: ['glow'], sale: true }) });
    expect(screen.getByRole('button', { name: 'Filters, 2 applied' })).toBeTruthy();
  });

  it('opens the filter groups in a dialog and moves focus into it', async () => {
    renderListing(<FilterDrawer />);
    const { dialog } = await open();
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(screen.getByRole('group', { name: 'Brand' })).toBeTruthy();
  });

  it('returns focus to the Filters button when Escape closes it', async () => {
    renderListing(<FilterDrawer />);
    const { button, dialog } = await open();
    await act(async () => fireEvent.keyDown(dialog, { key: 'Escape' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('applies filters while open and closes with "Show {total} products"', async () => {
    renderListing(<FilterDrawer />, { total: 6 });
    const { button } = await open();
    await act(async () =>
      fireEvent.click(screen.getByRole('checkbox', { name: /^Glow, 4 products$/ })),
    );
    expect(push).toHaveBeenLastCalledWith('/category/lips?brand=glow', { scroll: false });
    expect(screen.getByRole('dialog', { name: 'Filters' })).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Show 6 products' })));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('reads the result count out inside the dialog', async () => {
    // Open, the dialog hides the page's own live region from assistive tech: it has one of its own.
    renderListing(<FilterDrawer />, { total: 6 });
    const { dialog } = await open();
    const status = within(dialog).getByRole('status');
    expect(status.textContent).toBe('');
    await act(async () =>
      fireEvent.click(screen.getByRole('checkbox', { name: /^Glow, 4 products$/ })),
    );
    expect(status.textContent).toBe('6 products');
  });

  it('closes itself when the window grows to the sidebar layout, and focuses the sidebar', async () => {
    renderListing(<Drawer />);
    await open();
    await act(async () => {
      media.matches = true;
      for (const fn of media.listeners) fn();
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    // The Filters button is hidden at that width, so focus goes to the sidebar's heading.
    expect(document.activeElement).toBe(document.getElementById(FILTERS_HEADING_ID));
  });
});

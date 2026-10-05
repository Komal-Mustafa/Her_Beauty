// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FilterDrawer } from './filter-drawer';
import { params, renderListing } from './test-listing';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

afterEach(cleanup);

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
});

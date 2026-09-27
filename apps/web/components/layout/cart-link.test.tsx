// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CART_STORAGE_KEY, type CartLine } from '@/lib/cart-store';

const line = (over: Partial<CartLine> = {}): CartLine => ({
  variantId: 'silk-lip-oil-v1',
  productSlug: 'silk-lip-oil',
  title: 'Silk Lip Oil',
  image: '/placeholders/serum-1.svg',
  unitPrice: 120000,
  qty: 1,
  ...over,
});

/** A fresh cart store (and header link on top of it) per test, as on a new page load. */
async function load() {
  vi.resetModules();
  const [cart, { CartLink }] = await Promise.all([
    import('@/lib/cart-store'),
    import('./cart-link'),
  ]);
  return { cart, CartLink };
}

/** Server HTML first, then hydration, the way the header reaches the shopper. */
function hydrate(ui: React.ReactElement) {
  const container = document.createElement('div');
  container.innerHTML = renderToString(ui);
  document.body.append(container);
  return render(ui, { container, hydrate: true });
}

describe('CartLink', () => {
  let animate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    animate = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      writable: true,
      value: animate,
    });
  });

  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(HTMLElement.prototype, 'animate');
  });

  it('shows a saved cart after hydration without ticking', async () => {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([line({ qty: 3 })]));
    const { CartLink } = await load();
    // The server knows no cart: plain "Cart", no count.
    expect(renderToString(<CartLink />)).toContain('aria-label="Cart"');
    hydrate(<CartLink />);
    expect(await screen.findByRole('link', { name: 'Cart, 3 items' })).toBeTruthy();
    expect(animate).not.toHaveBeenCalled();
  });

  it('ticks when an add raises the count', async () => {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([line({ qty: 3 })]));
    const { cart, CartLink } = await load();
    hydrate(<CartLink />);
    await screen.findByRole('link', { name: 'Cart, 3 items' });
    act(() => void cart.addToCart({ ...line(), variantId: 'rose-dusk-palette-v1' }));
    expect(screen.getByRole('link', { name: 'Cart, 4 items' })).toBeTruthy();
    expect(animate).toHaveBeenCalledTimes(1);
  });

  it('ticks on the first item of an empty cart, not when the count drops', async () => {
    const { cart, CartLink } = await load();
    hydrate(<CartLink />);
    expect(screen.getByRole('link', { name: 'Cart' })).toBeTruthy();
    act(() => void cart.addToCart({ ...line(), qty: 2 }));
    expect(screen.getByRole('link', { name: 'Cart, 2 items' })).toBeTruthy();
    expect(animate).toHaveBeenCalledTimes(1);
    act(() => cart.setCartQty(line().variantId, 1));
    expect(screen.getByRole('link', { name: 'Cart, 1 item' })).toBeTruthy();
    expect(animate).toHaveBeenCalledTimes(1);
  });

  it('follows another tab', async () => {
    const { CartLink } = await load();
    hydrate(<CartLink />);
    const newValue = JSON.stringify([line({ qty: 2 })]);
    act(() => {
      window.localStorage.setItem(CART_STORAGE_KEY, newValue);
      window.dispatchEvent(new StorageEvent('storage', { key: CART_STORAGE_KEY, newValue }));
    });
    expect(screen.getByRole('link', { name: 'Cart, 2 items' })).toBeTruthy();
    expect(animate).toHaveBeenCalledTimes(1);
  });
});

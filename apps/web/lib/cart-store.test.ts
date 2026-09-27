import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addLine,
  CART_STORAGE_KEY,
  cartCount,
  cartSubtotal,
  clampQty,
  MAX_LINES,
  parseCart,
  removeLine,
  setLineQty,
  type CartLine,
} from './cart-store';
import { fakeWindow } from './test-window';

const line = (over: Partial<CartLine> = {}): CartLine => ({
  variantId: 'silk-lip-oil-v1',
  productSlug: 'silk-lip-oil',
  title: 'Silk Lip Oil',
  image: '/placeholders/serum-1.svg',
  unitPrice: 120000,
  qty: 1,
  ...over,
});

describe('cart lines (pure)', () => {
  it('clamps quantities to 1–10 whole units', () => {
    expect(clampQty(0)).toBe(1);
    expect(clampQty(-4)).toBe(1);
    expect(clampQty(3.9)).toBe(3);
    expect(clampQty(11)).toBe(10);
    expect(clampQty(Number.NaN)).toBe(1);
    expect(clampQty(Number.POSITIVE_INFINITY)).toBe(1);
  });

  it('merges the same variant and caps it at 10', () => {
    let lines = addLine([], line({ qty: 4 }));
    lines = addLine(lines, line({ qty: 4 }));
    expect(lines).toHaveLength(1);
    expect(lines[0]?.qty).toBe(8);
    lines = addLine(lines, line({ qty: 5 }));
    expect(lines[0]?.qty).toBe(10);
    // Already at the cap: same reference, so nothing re-renders or re-saves.
    expect(addLine(lines, line())).toBe(lines);
  });

  it('holds at most 50 different items', () => {
    const full = Array.from({ length: MAX_LINES }, (_, i) => line({ variantId: `v-${i}` }));
    expect(addLine(full, line({ variantId: 'one-more' }))).toBe(full);
  });

  it('sets and removes lines, returning the same reference when nothing changes', () => {
    const lines = [line(), line({ variantId: 'b', productSlug: 'b' })];
    expect(setLineQty(lines, 'b', 25)[1]?.qty).toBe(10);
    expect(setLineQty(lines, 'b', 1)).toBe(lines);
    expect(setLineQty(lines, 'missing', 3)).toBe(lines);
    expect(removeLine(lines, 'b')).toEqual([lines[0]]);
    expect(removeLine(lines, 'missing')).toBe(lines);
  });

  it('counts units and sums integer paisa', () => {
    const lines = [line({ qty: 2 }), line({ variantId: 'b', unitPrice: 185000, qty: 3 })];
    expect(cartCount(lines)).toBe(5);
    expect(cartSubtotal(lines)).toBe(2 * 120000 + 3 * 185000);
    expect(Number.isInteger(cartSubtotal(lines))).toBe(true);
  });
});

describe('parseCart (stored JSON is untrusted)', () => {
  it('keeps valid lines and merges repeats', () => {
    const parsed = parseCart([line({ qty: 2 }), line({ qty: 3 }), line({ variantId: 'b' })]);
    expect(parsed.map((l) => [l.variantId, l.qty])).toEqual([
      ['silk-lip-oil-v1', 5],
      ['b', 1],
    ]);
  });

  it.each([
    ['a float price', { unitPrice: 1200.5 }],
    ['a negative price', { unitPrice: -1 }],
    ['qty 0', { qty: 0 }],
    ['qty 11', { qty: 11 }],
    ['a fractional qty', { qty: 1.5 }],
    ['a bad slug', { productSlug: '../admin' }],
    ['a javascript: image', { image: 'javascript:alert(1)' }],
    ['a protocol-relative image', { image: '//evil.example/x.png' }],
    // Browsers read `\` as `/` and drop tabs and newlines: each of these is `//evil.example`.
    ['a backslash host image', { image: '/\\evil.example/pixel.png' }],
    ['a tab-split host image', { image: '/\t/evil.example/pixel.png' }],
    ['a newline-split host image', { image: '/\n/evil.example/pixel.png' }],
    ['a relative image', { image: 'placeholders/x.png' }],
    ['a plain-http image', { image: 'http://cdn.example/x.png' }],
    ['an empty title', { title: '' }],
  ])('drops a line with %s', (_, bad) => {
    expect(
      parseCart([{ ...line(), ...bad }, line({ variantId: 'ok' })]).map((l) => l.variantId),
    ).toEqual(['ok']);
  });

  it('accepts https images and same-site paths', () => {
    expect(parseCart([line({ image: 'https://media.herbeauty.pk/p/1.webp' })])).toHaveLength(1);
    expect(parseCart([line({ image: '/_next/image?url=%2Fx.png&w=640' })])).toHaveLength(1);
  });

  it.each([null, 'cart', 42, { lines: [] }])('turns %j into an empty cart', (value) => {
    expect(parseCart(value)).toEqual([]);
  });
});

describe('cart store', () => {
  let env: ReturnType<typeof fakeWindow>;
  beforeEach(() => {
    vi.resetModules();
    env = fakeWindow();
    vi.stubGlobal('window', env.win);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('adds, persists under hb_cart_v1 and reports limits', async () => {
    const cart = await import('./cart-store');
    const input = { ...line(), qty: undefined };
    expect(cart.addToCart(input)).toBe('added');
    expect(JSON.parse(env.data.get(CART_STORAGE_KEY) ?? '[]')).toEqual([line()]);
    expect(cart.getCartCount()).toBe(1);
    cart.setCartQty(line().variantId, 10);
    expect(cart.addToCart(input)).toBe('max-qty');
    expect(cart.getCartCount()).toBe(10);
    cart.removeFromCart(line().variantId);
    expect(cart.getCartCount()).toBe(0);
  });

  it('reports a full cart', async () => {
    env.data.set(
      CART_STORAGE_KEY,
      JSON.stringify(Array.from({ length: MAX_LINES }, (_, i) => line({ variantId: `v-${i}` }))),
    );
    const cart = await import('./cart-store');
    expect(cart.addToCart({ ...line(), variantId: 'new' })).toBe('full');
  });

  it('refuses a line that fails validation', async () => {
    const cart = await import('./cart-store');
    expect(cart.addToCart({ ...line(), unitPrice: 99.99 })).toBe('invalid');
    expect(cart.addToCart({ ...line(), image: 'javascript:alert(1)' })).toBe('invalid');
    expect(cart.getCartCount()).toBe(0);
    expect(env.data.has(CART_STORAGE_KEY)).toBe(false);
  });

  it('clamps the quantity it is given', async () => {
    const cart = await import('./cart-store');
    cart.addToCart({ ...line(), qty: 40 });
    expect(cart.getCartCount()).toBe(10);
  });

  it('renders an empty count on the server even with a saved cart', async () => {
    env.data.set(CART_STORAGE_KEY, JSON.stringify([line({ qty: 3 })]));
    const cart = await import('./cart-store');
    const Count = () => createElement('span', null, cart.useCartCount());
    expect(renderToString(createElement(Count))).toBe('<span>0</span>');
    expect(cart.getCartCount()).toBe(3);
  });
});

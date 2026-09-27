// @vitest-environment jsdom
import type { ProductCard } from '@hb/types';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CART_STORAGE_KEY, MAX_LINES, type CartLine } from '@/lib/cart-store';
import { WISHLIST_STORAGE_KEY } from '@/lib/wishlist-store';

const product: ProductCard = {
  id: 'prd-oil',
  slug: 'silk-lip-oil',
  title: 'Silk Lip Oil',
  brand: { id: 'br-glow', slug: 'glow', name: 'Glow' },
  seller: {
    id: 'sel-glow',
    slug: 'glow-cosmetics',
    storeName: 'Glow Cosmetics',
    type: 'manufacturer',
    badge: 'official_brand',
  },
  categoryId: 'cat-lips',
  images: [{ url: '/placeholders/serum-1.svg', alt: 'Silk Lip Oil', width: 800, height: 1000 }],
  price: 120000,
  compareAtPrice: null,
  currency: 'PKR',
  shades: [],
  rating: 4.6,
  ratingCount: 18,
  has3d: false,
  hasVideo: false,
  isNew: true,
  sponsored: false,
  quickAddVariantId: 'silk-lip-oil-v1',
};

const saved = (over: Partial<CartLine> = {}): CartLine => ({
  variantId: 'silk-lip-oil-v1',
  productSlug: 'silk-lip-oil',
  title: 'Silk Lip Oil',
  image: '/placeholders/serum-1.svg',
  unitPrice: 120000,
  qty: 1,
  ...over,
});

/** A fresh page: new stores, the header's cart link and one card. */
async function renderCard(p: ProductCard = product) {
  vi.resetModules();
  const [{ ToastProvider }, { ShopProductCard }, { CartLink }] = await Promise.all([
    import('@hb/ui'),
    import('./shop-product-card'),
    import('../layout/cart-link'),
  ]);
  render(
    <ToastProvider>
      <CartLink />
      <ShopProductCard product={p} />
    </ToastProvider>,
  );
}

// jsdom applies no CSS, so both copies of the action (hover overlay and touch) are present.
const addToCart = () => fireEvent.click(screen.getAllByRole('button', { name: /Add to cart/ })[0]!);
const toast = () => screen.getByRole('status');
const storedCart = (): CartLine[] =>
  JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? '[]') as CartLine[];

describe('ShopProductCard', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it('adds to the cart, updates the header count and says so with a way to the cart', async () => {
    await renderCard();
    addToCart();
    expect(storedCart()).toEqual([saved()]);
    expect(screen.getByRole('link', { name: 'Cart, 1 item' })).toBeTruthy();
    expect(within(toast()).getByText('Added to cart')).toBeTruthy();
    expect(within(toast()).getByText('Silk Lip Oil')).toBeTruthy();
    expect(within(toast()).getByRole('link', { name: 'View cart' }).getAttribute('href')).toBe(
      '/cart',
    );
  });

  it('says when the item is already in the cart ten times', async () => {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([saved({ qty: 10 })]));
    await renderCard();
    addToCart();
    expect(within(toast()).getByText('Already in your cart')).toBeTruthy();
    expect(within(toast()).getByText(/up to 10 of one item/)).toBeTruthy();
    expect(storedCart()[0]?.qty).toBe(10);
  });

  it('says when the cart is full', async () => {
    const full = Array.from({ length: MAX_LINES }, (_, i) => saved({ variantId: `v-${i}` }));
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(full));
    await renderCard();
    addToCart();
    expect(within(toast()).getByText('Your cart is full')).toBeTruthy();
    expect(storedCart()).toHaveLength(MAX_LINES);
  });

  it('refuses a product the cart cannot hold and points to the product page', async () => {
    await renderCard({
      ...product,
      images: [{ ...product.images[0]!, url: 'http://cdn.example/oil.png' }],
    });
    addToCart();
    expect(within(toast()).getByText('We couldn’t add this item')).toBeTruthy();
    expect(within(toast()).queryByRole('link')).toBeNull();
    expect(window.localStorage.getItem(CART_STORAGE_KEY)).toBeNull();
  });

  it('offers the product page instead when there is no one-click variant', async () => {
    await renderCard({ ...product, quickAddVariantId: null });
    expect(screen.queryByRole('button', { name: /Add to cart/ })).toBeNull();
    const [options] = screen.getAllByRole('link', { name: /See options/ });
    expect(options?.getAttribute('href')).toBe('/product/silk-lip-oil');
  });

  it('saves to and removes from the wishlist', async () => {
    await renderCard();
    const heart = screen.getByRole('button', { name: 'Save Silk Lip Oil to wishlist' });
    fireEvent.click(heart);
    expect(heart.getAttribute('aria-pressed')).toBe('true');
    expect(window.localStorage.getItem(WISHLIST_STORAGE_KEY)).toContain('prd-oil');
    fireEvent.click(heart);
    expect(heart.getAttribute('aria-pressed')).toBe('false');
  });
});

// @vitest-environment jsdom
import type { Product } from '@hb/types';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CART_STORAGE_KEY, MAX_LINES, type CartLine } from '@/lib/cart-store';
import { WISHLIST_STORAGE_KEY } from '@/lib/wishlist-store';
import { lipOil, lipstick, perfume } from './test-product';

// The flight itself is covered in lib/fly-to-cart.test.ts; here only that it is asked for.
const fly = vi.hoisted(() => vi.fn());
vi.mock('@/lib/fly-to-cart', () => ({ flyToCart: fly }));

/** The query of the URL as the app router knows it; null renders outside the router. */
const router = vi.hoisted(() => ({ search: null as string | null }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => (router.search === null ? null : new URLSearchParams(router.search)),
}));

const PAGE = '/product/velvet-matte-lipstick';

/** A fresh page (new stores): the header's cart link, the buy box and the sticky bar. */
async function renderBuyBox(product: Product = lipstick(), shade?: string) {
  vi.resetModules();
  const [{ ToastProvider }, { ProductProvider }, { BuyBox }, { StickyBuyBar }, { CartLink }, sel] =
    await Promise.all([
      import('@hb/ui'),
      import('./product-context'),
      import('./buy-box'),
      import('./sticky-buy-bar'),
      import('../layout/cart-link'),
      import('./variant-selection'),
    ]);
  render(
    <ToastProvider>
      <CartLink />
      <ProductProvider product={product} initialVariantId={sel.initialVariant(product, shade).id}>
        <section aria-label="Buy box">
          <BuyBox />
        </section>
        <StickyBuyBar />
      </ProductProvider>
    </ToastProvider>,
  );
}

const box = () => within(screen.getByRole('region', { name: 'Buy box' }));
const bar = () => document.querySelector<HTMLElement>('[data-sticky-buy-bar] > div')!;
const input = () => box().getByLabelText('Quantity') as HTMLInputElement;
const toast = () => screen.getByRole('status');
const storedCart = (): CartLine[] =>
  JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? '[]') as CartLine[];

/**
 * Stands in for the browser's IntersectionObserver as far as the sticky bar needs: it keeps the
 * root margin and, like a browser, calls back only when a move changes whether the observed
 * button intersects the root (the window, 800 px tall, plus the margin).
 */
const VIEWPORT = 800;
type Observed = {
  callback: IntersectionObserverCallback;
  targets: Element[];
  /** Bottom root margin in px. */
  below: number;
  intersecting?: boolean;
};
const observers: Observed[] = [];
class FakeIntersectionObserver {
  private readonly entry: Observed;
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    const below = Number.parseFloat(options?.rootMargin?.split(' ')[2] ?? '0');
    this.entry = { callback, targets: [], below };
    observers.push(this.entry);
  }
  observe(el: Element) {
    this.entry.targets.push(el);
  }
  unobserve() {}
  disconnect() {
    this.entry.targets = [];
  }
  takeRecords() {
    return [];
  }
}

/** Puts the observed button on screen, above the window or below it (a scroll or a jump). */
function mainButtonIs(where: 'visible' | 'above' | 'below') {
  const live = observers.filter((o) => o.targets.length > 0).at(-1)!;
  const top = where === 'above' ? -120 : where === 'below' ? 900 : 300;
  const bottom = top + 48;
  const isIntersecting = bottom >= 0 && top <= VIEWPORT + live.below;
  if (live.intersecting === isIntersecting) return;
  live.intersecting = isIntersecting;
  const entry = {
    isIntersecting,
    boundingClientRect: { top, bottom },
    target: live.targets[0],
  } as unknown as IntersectionObserverEntry;
  act(() => live.callback([entry], {} as IntersectionObserver));
}

beforeEach(() => {
  router.search = null;
  window.localStorage.clear();
  window.history.replaceState(null, '', PAGE);
  fly.mockClear();
  observers.length = 0;
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('BuyBox', () => {
  it('shows the brand, title, rating link and the chosen shade', async () => {
    await renderBuyBox();
    expect(box().getByRole('heading', { level: 1 }).textContent).toBe('Velvet Matte Lipstick');
    expect(box().getByRole('link', { name: 'Glow' }).getAttribute('href')).toBe('/brand/glow');
    const rating = box().getByRole('link', { name: /214 ratings/ });
    expect(rating.getAttribute('href')).toBe('#reviews');
    expect(box().getByRole('radio', { name: 'Berry Kiss' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(box().getByRole('radio', { name: 'Nude Silk, sold out' })).toBeTruthy();
  });

  it('says "No ratings yet" for a product nobody has rated', async () => {
    await renderBuyBox(lipstick({ rating: 0, ratingCount: 0 }));
    expect(box().getByRole('link', { name: 'No ratings yet' })).toBeTruthy();
  });

  it('adds the chosen shade and quantity, counts it in the header and flies from the button', async () => {
    await renderBuyBox();
    fireEvent.click(box().getByRole('button', { name: 'Increase quantity' }));
    fireEvent.click(box().getByRole('button', { name: 'Increase quantity' }));
    const add = box().getByRole('button', { name: 'Add to cart' });
    fireEvent.click(add);

    expect(storedCart()).toEqual([
      {
        variantId: 'velvet-v1',
        productSlug: 'velvet-matte-lipstick',
        title: 'Velvet Matte Lipstick, Berry Kiss',
        image: '/placeholders/lipstick-1.svg',
        unitPrice: 185000,
        qty: 3,
      },
    ]);
    expect(screen.getByRole('link', { name: 'Cart, 3 items' })).toBeTruthy();
    expect(within(toast()).getByText('Added to cart')).toBeTruthy();
    expect(within(toast()).getByText('3 × Velvet Matte Lipstick, Berry Kiss')).toBeTruthy();
    expect(fly).toHaveBeenCalledTimes(1);
    expect(fly).toHaveBeenCalledWith({
      imageSrc: '/placeholders/lipstick-1.svg',
      from: [null, add],
    });
  });

  it('adds only what fits next to the line already in the cart and says how many', async () => {
    const line = (qty: number) => ({
      variantId: 'velvet-v1',
      productSlug: 'velvet-matte-lipstick',
      title: 'Velvet Matte Lipstick, Berry Kiss',
      image: '/placeholders/lipstick-1.svg',
      unitPrice: 185000,
      qty,
    });
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([line(8)]));
    await renderBuyBox();
    fireEvent.change(input(), { target: { value: '4' } });
    fireEvent.blur(input());
    fireEvent.click(box().getByRole('button', { name: 'Add to cart' }));

    expect(storedCart()).toEqual([line(10)]);
    expect(screen.getByRole('link', { name: 'Cart, 10 items' })).toBeTruthy();
    expect(
      within(toast()).getByText(
        '2 × Velvet Matte Lipstick, Berry Kiss. You can buy up to 10 of one item per order.',
      ),
    ).toBeTruthy();
    expect(fly).toHaveBeenCalledTimes(1);
  });

  it('never puts more than the stock in the cart over repeated adds', async () => {
    const product = lipstick();
    product.variants[0] = { ...product.variants[0]!, stock: 3 };
    await renderBuyBox(product);
    fireEvent.click(box().getByRole('button', { name: 'Increase quantity' }));
    const add = box().getByRole('button', { name: 'Add to cart' });
    fireEvent.click(add);
    expect(storedCart()[0]?.qty).toBe(2);
    expect(within(toast()).getByText('2 × Velvet Matte Lipstick, Berry Kiss')).toBeTruthy();

    // Two more asked for, one left.
    fireEvent.click(add);
    expect(storedCart()[0]?.qty).toBe(3);
    expect(
      screen.getByText('Velvet Matte Lipstick, Berry Kiss. Only 3 left in stock.'),
    ).toBeTruthy();

    fireEvent.click(add);
    expect(storedCart()[0]?.qty).toBe(3);
    expect(screen.getByText('Already in your cart')).toBeTruthy();
    expect(screen.getAllByText('Only 3 left in stock.')).toHaveLength(1);
    expect(fly).toHaveBeenCalledTimes(2);
  });

  it('says so and does not fly when the cart cannot take the item', async () => {
    const full = Array.from({ length: MAX_LINES }, (_, i) => ({
      variantId: `v-${i}`,
      productSlug: 'other',
      title: 'Other',
      image: '/placeholders/serum-1.svg',
      unitPrice: 1000,
      qty: 1,
    }));
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(full));
    await renderBuyBox();
    fireEvent.click(box().getByRole('button', { name: 'Add to cart' }));
    expect(within(toast()).getByText('Your cart is full')).toBeTruthy();
    expect(fly).not.toHaveBeenCalled();
  });

  it('writes a shade change to ?shade= in place, keeping other parameters', async () => {
    window.history.replaceState(null, '', `${PAGE}?tier=mid`);
    const entries = window.history.length;
    await renderBuyBox();
    fireEvent.click(box().getByRole('radio', { name: 'Rose Petal' }));
    expect(box().getByRole('radio', { name: 'Rose Petal' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(window.location.pathname).toBe(PAGE);
    expect(window.location.search).toBe('?tier=mid&shade=rose-petal');
    expect(window.history.length).toBe(entries);

    fireEvent.click(box().getByRole('button', { name: 'Add to cart' }));
    expect(storedCart()[0]).toMatchObject({
      variantId: 'velvet-v2',
      title: 'Velvet Matte Lipstick, Rose Petal',
    });
  });

  it('takes the shade from the router URL when Back brings back a page rendered without it', async () => {
    // The cached page was rendered for /product/velvet-matte-lipstick (Berry Kiss), the history
    // entry's URL has the shade picked before leaving.
    router.search = 'shade=nude-silk';
    await renderBuyBox();
    expect(
      box().getByRole('radio', { name: 'Nude Silk, sold out' }).getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      (box().getByRole('button', { name: 'Out of stock' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("writes the shade without Next's history state, so the router records the URL", async () => {
    // The entry as the app router leaves it.
    window.history.replaceState({ __NA: true }, '', PAGE);
    const replace = vi.spyOn(window.history, 'replaceState');
    await renderBuyBox();
    fireEvent.click(box().getByRole('radio', { name: 'Rose Petal' }));
    // Next's patched replaceState skips its own bookkeeping for a state object it made itself.
    expect(replace).toHaveBeenLastCalledWith(null, '', expect.any(URL));
    expect(String(replace.mock.lastCall?.[2])).toMatch(/\?shade=rose-petal$/);
  });

  it('shows a sold-out shade from the URL with the out-of-stock state', async () => {
    await renderBuyBox(lipstick(), 'nude-silk');
    expect(
      box().getByRole('radio', { name: 'Nude Silk, sold out' }).getAttribute('aria-checked'),
    ).toBe('true');
    // The stock note and the disabled button.
    expect(box().getAllByText('Out of stock')).toHaveLength(2);
    expect(
      (box().getByRole('button', { name: 'Out of stock' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(box().queryByRole('button', { name: 'Add to cart' })).toBeNull();
    expect(input().disabled).toBe(true);

    const save = box().getByRole('button', { name: 'Save to wishlist' });
    fireEvent.click(save);
    expect(save.getAttribute('aria-pressed')).toBe('true');
    expect(window.localStorage.getItem(WISHLIST_STORAGE_KEY)).toContain('prd-1');
  });

  it('says "Only n left" at low stock and caps the quantity at the stock', async () => {
    const product = lipstick();
    product.variants[0] = { ...product.variants[0]!, stock: 3 };
    await renderBuyBox(product);
    expect(box().getByText('Only 3 left')).toBeTruthy();
    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(box().getByRole('button', { name: 'Increase quantity' }));
    }
    expect(input().value).toBe('3');
  });

  it('lowers the quantity when the next shade has less stock', async () => {
    const product = lipstick();
    product.variants[1] = { ...product.variants[1]!, stock: 2 };
    await renderBuyBox(product);
    fireEvent.change(input(), { target: { value: '6' } });
    fireEvent.blur(input());
    expect(input().value).toBe('6');
    fireEvent.click(box().getByRole('radio', { name: 'Rose Petal' }));
    expect(input().value).toBe('2');
  });

  it('offers size pills when the variants differ by size, without touching the URL', async () => {
    window.history.replaceState(null, '', '/product/damask-rose-eau-de-parfum');
    await renderBuyBox(perfume());
    expect(box().queryByRole('radiogroup', { name: 'Shade' })).toBeNull();
    const sizes = box().getByRole('group', { name: /Size/ });
    expect(sizes.querySelector('legend')?.textContent).toBe('Size: 50 ml');
    fireEvent.click(within(sizes).getByRole('radio', { name: '100 ml' }));
    expect(sizes.querySelector('legend')?.textContent).toBe('Size: 100 ml');
    expect(box().getByText(/14,000/)).toBeTruthy();
    expect(window.location.search).toBe('');

    fireEvent.click(box().getByRole('button', { name: 'Add to cart' }));
    expect(storedCart()[0]).toMatchObject({
      variantId: 'damask-100',
      title: 'Damask Rose Eau de Parfum, 100 ml',
      unitPrice: 1400000,
    });
  });

  it('marks a sold-out size and keeps it selectable', async () => {
    const product = perfume();
    product.variants[1] = { ...product.variants[1]!, stock: 0 };
    await renderBuyBox(product);
    fireEvent.click(box().getByRole('radio', { name: '100 ml, sold out' }));
    expect(
      (box().getByRole('button', { name: 'Out of stock' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('has no picker for a single variant and adds it under the product title', async () => {
    await renderBuyBox(lipOil());
    expect(box().queryByRole('radio')).toBeNull();
    // Nothing between the price and the quantity: an empty block would double the gap.
    const price = box().getByText(/1,200/).closest('.gap-6 > *');
    expect(price?.nextElementSibling?.textContent).toContain('Quantity');
    fireEvent.click(box().getByRole('button', { name: 'Add to cart' }));
    expect(storedCart()[0]).toMatchObject({ variantId: 'silk-lip-oil-v1', title: 'Silk Lip Oil' });
    expect(within(toast()).getByText('Silk Lip Oil')).toBeTruthy();
  });

  it('shows a single pack size under the price', async () => {
    const oil = lipOil();
    await renderBuyBox(lipOil({ variants: [{ ...oil.variants[0]!, sizeLabel: '6 ml' }] }));
    expect(box().getByText('6 ml').parentElement?.textContent).toBe('Size: 6 ml');
    cleanup();
    await renderBuyBox(perfume());
    // Size pills already say it.
    expect(box().queryByText(/^Size: \d/)).toBeNull();
  });

  it('drops the quantity when no variant is in stock, and offers the wishlist', async () => {
    const product = lipstick();
    await renderBuyBox({ ...product, variants: product.variants.map((v) => ({ ...v, stock: 0 })) });
    expect(box().queryByLabelText('Quantity')).toBeNull();
    expect(
      (box().getByRole('button', { name: 'Out of stock' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(box().getByRole('button', { name: 'Save to wishlist' })).toBeTruthy();
  });

  it('toggles the wishlist heart', async () => {
    await renderBuyBox();
    const heart = box().getByRole('button', { name: 'Save Velvet Matte Lipstick to wishlist' });
    expect(heart.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(heart);
    expect(heart.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(heart);
    expect(heart.getAttribute('aria-pressed')).toBe('false');
  });
});

describe('StickyBuyBar', () => {
  it('watches the buy box button and shows only once it has scrolled away above', async () => {
    await renderBuyBox();
    const add = box().getByRole('button', { name: 'Add to cart' });
    expect(observers.at(-1)?.targets).toEqual([add]);

    expect(bar().hasAttribute('inert')).toBe(true);
    mainButtonIs('below');
    expect(bar().hasAttribute('inert')).toBe(true);
    mainButtonIs('above');
    expect(bar().hasAttribute('inert')).toBe(false);
    expect(bar().className).toContain('translate-y-0');
    mainButtonIs('visible');
    expect(bar().hasAttribute('inert')).toBe(true);
    expect(bar().className).toContain('translate-y-full');
  });

  it('follows a jump straight past the button and back (#reviews, back to the top)', async () => {
    await renderBuyBox();
    // On load the button is below the fold, then the rating link jumps to #reviews.
    mainButtonIs('below');
    expect(bar().hasAttribute('inert')).toBe(true);
    mainButtonIs('above');
    expect(bar().hasAttribute('inert')).toBe(false);
    // Back to the top in one go: the button is below the fold again.
    mainButtonIs('below');
    expect(bar().hasAttribute('inert')).toBe(true);
  });

  it('keeps focus scrolling and toasts clear of the bar only while it is shown', async () => {
    // jsdom does no layout: the bar is 72 px tall below 1024 px.
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.hasAttribute('data-sticky-buy-bar') ? 72 : 0;
    });
    const html = document.documentElement.style;
    const body = document.body.style;
    await renderBuyBox();
    expect(html.getPropertyValue('--toast-offset')).toBe('');
    expect(html.getPropertyValue('scroll-padding-bottom')).toBe('');
    // The page already has the bar's height below the footer: the bar can appear after a jump to
    // the very end and the document must not grow under the reader.
    expect(body.getPropertyValue('padding-bottom')).toBe('72px');

    mainButtonIs('above');
    expect(html.getPropertyValue('--toast-offset')).toBe('72px');
    expect(html.getPropertyValue('scroll-padding-bottom')).toBe('calc(72px + 1rem)');
    expect(body.getPropertyValue('padding-bottom')).toBe('72px');

    mainButtonIs('visible');
    expect(html.getPropertyValue('--toast-offset')).toBe('');
    expect(html.getPropertyValue('scroll-padding-bottom')).toBe('');
    expect(body.getPropertyValue('padding-bottom')).toBe('72px');

    mainButtonIs('above');
    cleanup();
    expect(html.getPropertyValue('--toast-offset')).toBe('');
    expect(html.getPropertyValue('scroll-padding-bottom')).toBe('');
    expect(body.getPropertyValue('padding-bottom')).toBe('');
  });

  it('takes no taps while hidden: only the shown panel catches the pointer', async () => {
    await renderBuyBox();
    const wrapper = bar().parentElement!;
    // Fixed to the bottom of the window, so its box is there even while the bar is hidden.
    expect(wrapper.className).toContain('fixed');
    expect(wrapper.className).toContain('pointer-events-none');
    expect(bar().className).toContain('pointer-events-none');
    expect(bar().className).not.toContain('pointer-events-auto');
    mainButtonIs('above');
    expect(bar().className).toContain('pointer-events-auto');
    mainButtonIs('visible');
    expect(bar().className).not.toContain('pointer-events-auto');
  });

  it('reserves nothing where the bar is not displayed (from 1024 px)', async () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(0);
    await renderBuyBox();
    mainButtonIs('above');
    expect(document.documentElement.style.getPropertyValue('--toast-offset')).toBe('');
    expect(document.documentElement.style.getPropertyValue('scroll-padding-bottom')).toBe('');
    expect(document.body.style.getPropertyValue('padding-bottom')).toBe('');
  });

  it('shows the shade and price and adds from its own button', async () => {
    await renderBuyBox();
    mainButtonIs('above');
    const inBar = within(bar());
    expect(inBar.getByText('Berry Kiss')).toBeTruthy();
    expect(inBar.getByText(/1,850/)).toBeTruthy();
    const add = inBar.getByRole('button', { name: 'Add to cart' });
    fireEvent.click(add);
    expect(screen.getByRole('link', { name: 'Cart, 1 item' })).toBeTruthy();
    expect(fly).toHaveBeenCalledWith(expect.objectContaining({ from: [null, add] }));
  });

  it('follows a sold-out shade and watches the new buy box button', async () => {
    await renderBuyBox();
    fireEvent.click(box().getByRole('radio', { name: 'Nude Silk, sold out' }));
    const out = box().getByRole('button', { name: 'Out of stock' });
    expect(observers.filter((o) => o.targets.length > 0).at(-1)?.targets).toEqual([out]);
    mainButtonIs('above');
    const inBar = within(bar());
    expect(inBar.getByText('Nude Silk')).toBeTruthy();
    expect(
      (inBar.getByRole('button', { name: 'Out of stock' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

import type { ProductCard as ProductCardData } from '@hb/types';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProductCard } from './product-card';

afterEach(cleanup);

const base: ProductCardData = {
  id: 'prd-1',
  slug: 'velvet-matte-lipstick',
  title: 'Velvet Matte Lipstick',
  brand: { id: 'br-glow', slug: 'glow', name: 'Glow' },
  seller: {
    id: 'sel-glow',
    slug: 'glow-cosmetics',
    storeName: 'Glow Cosmetics',
    type: 'manufacturer',
    badge: 'official_brand',
  },
  categoryId: 'cat-lips',
  images: [
    { url: '/placeholders/lipstick-1.svg', alt: 'Velvet Matte Lipstick', width: 800, height: 1000 },
    { url: '/placeholders/lipstick-2.svg', alt: 'Alternate view', width: 800, height: 1000 },
  ],
  price: 185000,
  compareAtPrice: 220000,
  currency: 'PKR',
  shades: [],
  rating: 4.8,
  ratingCount: 214,
  has3d: false,
  hasVideo: false,
  isNew: false,
  sponsored: false,
  quickAddVariantId: 'velvet-matte-lipstick-v1',
};

const shades = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ name: `Shade ${i + 1}`, hex: '#C2185B' }));

describe('ProductCard', () => {
  it('is one link to the product page, named by the title', () => {
    render(<ProductCard product={base} />);
    const link = screen.getByRole('link', { name: 'Velvet Matte Lipstick' });
    expect(link.getAttribute('href')).toBe('/product/velvet-matte-lipstick');
    // The stretched ::after layer is what makes the whole card clickable.
    expect(link.className).toContain('after:absolute');
    expect(link.className).toContain('after:inset-0');
  });

  it('lifts a layer inside the hover target, so a resting pointer never loses the hover', () => {
    render(<ProductCard product={base} />);
    const card = screen.getByRole('article');
    expect(card.className).toContain('group/card');
    expect(card.className).not.toMatch(/translate/);
    const surface = card.firstElementChild;
    expect(surface?.className).toContain('group-hover/card:-translate-y-1');
    expect(surface?.contains(screen.getByRole('link', { name: base.title }))).toBe(true);
  });

  it('shows price from paisa with the compare-at price', () => {
    render(<ProductCard product={base} />);
    expect(screen.getByText('Rs 1,850')).toBeTruthy();
    expect(screen.getByText('Rs 2,200')).toBeTruthy();
  });

  it('labels sponsored, new and 3D products', () => {
    render(<ProductCard product={{ ...base, sponsored: true, isNew: true, has3d: true }} />);
    expect(screen.getByText('Sponsored')).toBeTruthy();
    expect(screen.getByText('New')).toBeTruthy();
    expect(screen.getByText('3D')).toBeTruthy();
  });

  it('never shows Sponsored on an organic product', () => {
    render(<ProductCard product={base} />);
    expect(screen.queryByText('Sponsored')).toBeNull();
  });

  it('crossfades to the second image, which is decorative', () => {
    const { container } = render(<ProductCard product={base} />);
    const imgs = container.querySelectorAll('img');
    expect(imgs).toHaveLength(2);
    expect(imgs[0]?.getAttribute('alt')).toBe('Velvet Matte Lipstick');
    expect(imgs[1]?.getAttribute('alt')).toBe('');
    expect(imgs[1]?.className).toContain('group-hover/card:opacity-100');
  });

  it('shows at most five shade dots plus a "+n" count', () => {
    const { container } = render(<ProductCard product={{ ...base, shades: shades(8) }} />);
    expect(container.querySelectorAll('span[style*="background-color"]')).toHaveLength(5);
    expect(screen.getByText('+3')).toBeTruthy();
    expect(screen.getByText('8 shades')).toBeTruthy();
  });

  it('adds to cart in one click when the product has a quick-add variant', () => {
    const onAddToCart = vi.fn();
    render(<ProductCard product={base} onAddToCart={onAddToCart} />);
    // One copy for hover devices (on the image), one for touch (under the price); CSS shows one.
    const buttons = screen.getAllByRole('button', { name: 'Add to cart: Velvet Matte Lipstick' });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0] as HTMLElement);
    expect(onAddToCart).toHaveBeenCalledWith(base);
  });

  it('links to "Choose shade" when the shopper must pick a shade', () => {
    render(
      <ProductCard
        product={{ ...base, quickAddVariantId: null, shades: shades(4) }}
        onAddToCart={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /Add to cart/ })).toBeNull();
    const links = screen.getAllByRole('link', { name: 'Choose shade: Velvet Matte Lipstick' });
    expect(links[0]?.getAttribute('href')).toBe('/product/velvet-matte-lipstick');
  });

  it('links to "See options" without shades or quick add', () => {
    render(<ProductCard product={{ ...base, quickAddVariantId: null }} onAddToCart={vi.fn()} />);
    expect(
      screen.getAllByRole('link', { name: 'See options: Velvet Matte Lipstick' }),
    ).toHaveLength(2);
  });

  it('shows the busy state while adding', () => {
    render(<ProductCard product={base} onAddToCart={vi.fn()} adding />);
    const [button] = screen.getAllByRole('button', { name: /Adding/ });
    expect(button?.hasAttribute('disabled')).toBe(true);
    expect(button?.getAttribute('aria-busy')).toBe('true');
  });

  it('toggles the wishlist heart with aria-pressed', () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <ProductCard product={base} onToggleWishlist={onToggle} wishlisted={false} />,
    );
    const heart = screen.getByRole('button', { name: 'Save Velvet Matte Lipstick to wishlist' });
    expect(heart.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(heart);
    expect(onToggle).toHaveBeenCalledWith(base);
    rerender(<ProductCard product={base} onToggleWishlist={onToggle} wishlisted />);
    expect(heart.getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps interactive controls above the stretched link', () => {
    render(<ProductCard product={base} onToggleWishlist={vi.fn()} onAddToCart={vi.fn()} />);
    const heart = screen.getByRole('button', { name: /wishlist/ });
    expect(heart.className).toContain('z-[2]');
    for (const b of screen.getAllByRole('button', { name: /Add to cart/ })) {
      expect(b.className).toContain('z-[2]');
    }
  });

  it('shows the seller with a compact verified or official badge', () => {
    const { rerender } = render(<ProductCard product={base} />);
    expect(
      within(screen.getByText('Glow Cosmetics').parentElement as HTMLElement).getByText('Official'),
    ).toBeTruthy();
    rerender(
      <ProductCard product={{ ...base, seller: { ...base.seller, badge: 'verified_seller' } }} />,
    );
    expect(screen.getByText('Verified')).toBeTruthy();
  });

  it('uses the link and image components the app passes in', () => {
    const Link = ({
      href,
      className,
      children,
    }: {
      href: string;
      className?: string;
      children: ReactNode;
    }) => (
      <a href={href} className={className} data-app-link="">
        {children}
      </a>
    );
    const Img = ({ src, alt }: { src: string; alt: string }) => (
      <img src={src} alt={alt} data-app-img="" />
    );
    const { container } = render(<ProductCard product={base} linkAs={Link} imageAs={Img} />);
    expect(container.querySelectorAll('[data-app-link]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-app-img]')).toHaveLength(2);
  });
});

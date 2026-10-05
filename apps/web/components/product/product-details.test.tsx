// @vitest-environment jsdom
import type { Store } from '@hb/types';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Breadcrumbs } from '../layout/breadcrumbs';
import { ProductDetails } from './product-details';
import { SellerCard } from './seller-card';
import { lipOil, lipstick } from './test-product';

afterEach(cleanup);

describe('ProductDetails', () => {
  it('renders the sanitized description and the plain-text sections under h2s', () => {
    const product = lipstick({
      descriptionHtml:
        '<p onclick="steal()">Soft <strong>matte</strong> colour.</p><script>steal()</script><ul><li><a href="javascript:steal()">Long</a> wear</li></ul>',
      howToUse: 'Line the lips.\nFill in.',
    });
    const { container } = render(<ProductDetails product={product} />);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Description',
      'How to use',
      'Ingredients',
    ]);
    const description = screen.getByRole('region', { name: 'Description' });
    expect(within(description).getByText('matte').tagName).toBe('STRONG');
    expect(within(description).getByRole('listitem').textContent).toBe('Long wear');
    expect(container.querySelector('script, a, [onclick]')).toBeNull();
    expect(
      within(screen.getByRole('region', { name: 'How to use' })).getByText(/Line the lips/)
        .textContent,
    ).toBe('Line the lips.\nFill in.');
  });

  it('leaves out the sections a product does not have', () => {
    render(<ProductDetails product={lipOil({ howToUse: null, ingredients: '  ' })} />);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Description',
    ]);
  });

  it('renders nothing when there is nothing to say', () => {
    const { container } = render(
      <ProductDetails
        product={lipOil({ descriptionHtml: ' ', howToUse: null, ingredients: null })}
      />,
    );
    expect(container.innerHTML).toBe('');
  });
});

describe('SellerCard', () => {
  const seller = lipstick().seller;
  const logo = { url: '/placeholders/logo-glow.svg', alt: 'Glow', width: 200, height: 200 };
  const store: Store = {
    id: seller.id,
    slug: seller.slug,
    storeName: seller.storeName,
    type: seller.type,
    badge: seller.badge,
    logo,
    city: 'Lahore',
    rating: 4.8,
    banner: { ...logo, url: '/placeholders/banner-glow.svg' },
    about: 'Glow makes lipsticks.',
    joinedAt: '2025-01-01T00:00:00.000Z',
    productCount: 12,
  };

  it('names the seller, its badge, kind, city and rating, with links to the store', () => {
    render(<SellerCard seller={seller} store={store} />);
    const card = within(screen.getByRole('region', { name: 'Glow Cosmetics' }));
    expect(card.getByRole('link', { name: 'Glow Cosmetics' }).getAttribute('href')).toBe(
      '/store/glow-cosmetics',
    );
    expect(card.getByRole('link', { name: 'Visit store' }).getAttribute('href')).toBe(
      '/store/glow-cosmetics',
    );
    expect(card.getByText('Official Brand')).toBeTruthy();
    expect(card.getByText('Manufacturer · Lahore')).toBeTruthy();
    expect(card.getByText('seller rating')).toBeTruthy();
  });

  it('still shows who sells it when the store could not be loaded', () => {
    render(
      <SellerCard seller={{ ...seller, type: 'vendor', badge: 'verified_seller' }} store={null} />,
    );
    const card = within(screen.getByRole('region', { name: 'Glow Cosmetics' }));
    expect(card.getByText('Verified Seller')).toBeTruthy();
    expect(card.getByText('Vendor')).toBeTruthy();
    expect(card.queryByText('seller rating')).toBeNull();
  });
});

describe('Breadcrumbs', () => {
  it('is a named list whose last item is the current page, not a link', () => {
    render(
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Lips', href: '/category/lips' },
          { label: 'Velvet Matte Lipstick', href: '/product/velvet-matte-lipstick' },
        ]}
      />,
    );
    const nav = within(screen.getByRole('navigation', { name: 'Breadcrumb' }));
    expect(nav.getAllByRole('listitem')).toHaveLength(3);
    expect(nav.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([
      '/',
      '/category/lips',
    ]);
    expect(nav.getByText('Velvet Matte Lipstick').getAttribute('aria-current')).toBe('page');
  });

  it('renders nothing without items', () => {
    const { container } = render(<Breadcrumbs items={[]} />);
    expect(container.innerHTML).toBe('');
  });
});

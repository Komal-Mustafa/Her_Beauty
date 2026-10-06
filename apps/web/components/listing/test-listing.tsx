import type { ProductFacets } from '@hb/types';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { EMPTY_LISTING, type ListingKind, type ListingParams } from '@/lib/listing-url';
import { ListingProvider } from './listing-context';

/** Facets of a small category page: 12 brands (so the list folds), some options at 0. */
export const FACETS: ProductFacets = {
  categories: [
    { value: 'lips', label: 'Lips', count: 6 },
    { value: 'face', label: 'Face', count: 0 },
    { value: 'eyes', label: 'Eyes', count: 2 },
  ],
  brands: [
    'Amla Grove',
    'Chambeli',
    'Dewy',
    'Glow',
    'Lumière',
    'Mehr',
    'Qamar',
    'Rose House',
    'Saffron & Co',
    'Surmai',
    'Velvet',
    'Zero Brand',
  ].map((label, i) => ({
    value: label.toLowerCase().replace(/[^a-z]+/g, '-'),
    label,
    count: label === 'Zero Brand' ? 0 : i + 1,
  })),
  shades: [
    { value: 'nude', label: 'Nude', count: 5, hex: '#C98A7A' },
    { value: 'red', label: 'Red', count: 3, hex: '#B3122E' },
    { value: 'gold', label: 'Gold', count: 0, hex: '#D4AF37' },
  ],
  skinTypes: [
    { value: 'dry', label: 'Dry', count: 0 },
    { value: 'oily', label: 'Oily', count: 0 },
  ],
  sellerTypes: [
    { value: 'vendor', label: 'Resellers', count: 3 },
    { value: 'manufacturer', label: 'Official brand stores', count: 3 },
  ],
  ratings: [
    { value: '4', label: '4 stars & up', count: 5 },
    { value: '3', label: '3 stars & up', count: 6 },
  ],
  onSale: 2,
  price: { min: 65050, max: 1200000 },
};

export const params = (over: Partial<ListingParams> = {}): ListingParams => ({
  ...EMPTY_LISTING,
  ...over,
});

type Options = {
  kind?: ListingKind;
  path?: string;
  params?: ListingParams;
  facets?: ProductFacets;
  total?: number;
};

/** Renders listing UI inside its provider, as on a category page by default. */
export function renderListing(ui: ReactNode, options: Options = {}) {
  return render(
    <ListingProvider
      kind={options.kind ?? 'category'}
      path={options.path ?? '/category/lips'}
      params={options.params ?? params()}
      facets={options.facets ?? FACETS}
      total={options.total ?? 6}
    >
      {ui}
    </ListingProvider>,
  );
}

import { describe, expect, it } from 'vitest';
import { EMPTY_LISTING, type ListingParams } from '@/lib/listing-url';
import { listingMetadata } from './listing-metadata';

const params = (over: Partial<ListingParams> = {}): ListingParams => ({
  ...EMPTY_LISTING,
  ...over,
});

const meta = (over: Partial<Parameters<typeof listingMetadata>[0]> = {}) =>
  listingMetadata({
    kind: 'category',
    path: '/category/lips',
    title: 'Lips',
    description: 'Shop lips.',
    params: params(),
    raw: {},
    ...over,
  });

/** `robots: { index: false, follow: true }`, or nothing when the page may be indexed. */
const robots = (over?: Partial<Parameters<typeof listingMetadata>[0]>) => meta(over).robots;

describe('listingMetadata', () => {
  it('titles the page and keeps the canonical clean until page 2', () => {
    expect(meta().title).toEqual({ absolute: 'Lips | Her Beauty' });
    expect(meta().alternates?.canonical).toBe('/category/lips');
    expect(meta({ params: params({ page: 3 }), pageCount: 5 }).alternates?.canonical).toBe(
      '/category/lips?page=3',
    );
  });

  it('indexes a plain page of results', () => {
    expect(robots()).toBeUndefined();
    expect(robots({ params: params({ page: 2 }), pageCount: 4 })).toBeUndefined();
  });

  it('keeps filtered, re-sorted and search pages out of the index', () => {
    expect(robots({ params: params({ sale: true }) })).toEqual({ index: false, follow: true });
    expect(robots({ params: params({ sort: 'price_asc' }), raw: { sort: 'price_asc' } })).toEqual({
      index: false,
      follow: true,
    });
    // The page's own default order: nothing in the params, but the URL carries `sort` (§2.3).
    expect(robots({ raw: { sort: 'best_selling' } })).toEqual({ index: false, follow: true });
    expect(robots({ kind: 'search', path: '/search', params: undefined, raw: undefined })).toEqual({
      index: false,
      follow: true,
    });
  });

  it('keeps a page past the last one out of the index', () => {
    expect(robots({ params: params({ page: 2 }), pageCount: 1 })).toEqual({
      index: false,
      follow: true,
    });
    // Nothing matches at all: page 1 is still the page to index.
    expect(robots({ pageCount: 0 })).toBeUndefined();
  });
});

import { ProductSort, SellerType, ShadeFamily, SkinType, type ProductFacets } from '@hb/types';
import { describe, expect, it } from 'vitest';
import {
  activeChips,
  cleared,
  EMPTY_LISTING,
  hasFilterOrSort,
  listingHref,
  listingSearchParams,
  paisaToRupees,
  parseListingParams,
  rupeesToPaisa,
  SORT_LABEL,
  sortOptions,
  toSearchQuery,
  withChange,
  type ListingParams,
} from './listing-params';

const sp = (query: string) => new URLSearchParams(query);
const params = (over: Partial<ListingParams> = {}): ListingParams => ({
  ...EMPTY_LISTING,
  ...over,
});

describe('parseListingParams', () => {
  it('reads every documented param', () => {
    const p = parseListingParams(
      'search',
      sp(
        'q=matte+lipstick&category=lips&brand=glow&brand=velvet&shade=red&shade=nude&skin=dry' +
          '&type=manufacturer&min=1000&max=3000&rating=4&sale=1&sort=price_asc&page=2',
      ),
    );
    expect(p).toEqual({
      q: 'matte lipstick',
      category: 'lips',
      brand: ['glow', 'velvet'],
      shade: ['red', 'nude'],
      skin: ['dry'],
      type: 'manufacturer',
      min: 1000,
      max: 3000,
      rating: 4,
      sale: true,
      sort: 'price_asc',
      page: 2,
    });
  });

  it('takes the record Next passes as searchParams', () => {
    expect(
      parseListingParams('new', { brand: ['glow', 'velvet'], sale: '1', page: '3', utm: 'x' }),
    ).toEqual(params({ brand: ['glow', 'velvet'], sale: true, page: 3 }));
    expect(parseListingParams('new', {})).toEqual(EMPTY_LISTING);
  });

  it('drops invalid values instead of failing', () => {
    const p = parseListingParams(
      'search',
      sp(
        'category=Lips!&brand=GLOW&brand=glow&shade=teal&skin=greasy&type=shop&min=1e3&max=-5' +
          '&rating=5&sale=yes&sort=cheapest&page=abc',
      ),
    );
    expect(p).toEqual(params({ brand: ['glow'] }));
  });

  it('keeps prices whole rupees, swaps a reversed range and caps it', () => {
    expect(parseListingParams('new', sp('min=1500.50&max=2000'))).toEqual(params({ max: 2000 }));
    expect(parseListingParams('new', sp('min=3000&max=1000'))).toEqual(
      params({ min: 1000, max: 3000 }),
    );
    expect(parseListingParams('new', sp('max=10000001')).max).toBeUndefined();
    expect(parseListingParams('new', sp('min=0')).min).toBe(0);
  });

  it('bounds the page to 1–500', () => {
    expect(parseListingParams('new', sp('page=1')).page).toBe(1);
    expect(parseListingParams('new', sp('page=500')).page).toBe(500);
    expect(parseListingParams('new', sp('page=501')).page).toBe(1);
    expect(parseListingParams('new', sp('page=0')).page).toBe(1);
    expect(parseListingParams('new', sp('page=-2')).page).toBe(1);
    expect(parseListingParams('new', sp('page=2.5')).page).toBe(1);
  });

  it('uses the first valid value of a single param and every valid value of a repeated one', () => {
    const p = parseListingParams(
      'search',
      sp('sort=nope&sort=newest&sort=rating&page=x&page=4&page=7&shade=red&shade=pink&shade=red'),
    );
    expect(p.sort).toBe('newest');
    expect(p.page).toBe(4);
    expect(p.shade).toEqual(['red', 'pink']);
    expect(parseListingParams('search', sp('q=&q=%20%20&q=%20serum%20')).q).toBe('serum');
  });

  it('caps a repeated param at 20 values', () => {
    const many = Array.from({ length: 30 }, (_, i) => `brand=b${i}`).join('&');
    expect(parseListingParams('search', sp(many)).brand).toHaveLength(20);
  });

  it('trims the search text and cuts it to 100 characters', () => {
    expect(parseListingParams('search', sp(`q=${'a'.repeat(150)}`)).q).toHaveLength(100);
    expect(parseListingParams('search', sp('q=%20%20')).q).toBeUndefined();
  });

  it('ignores params a page does not offer', () => {
    // The category of a category page, the brand of a brand page… are fixed, never params.
    expect(parseListingParams('category', sp('category=eyes&brand=glow')).category).toBeUndefined();
    expect(parseListingParams('brand', sp('brand=velvet&category=lips')).brand).toEqual([]);
    expect(parseListingParams('store', sp('type=vendor')).type).toBeUndefined();
    expect(parseListingParams('offers', sp('sale=1')).sale).toBe(false);
    // Only the search page reads q.
    expect(parseListingParams('new', sp('q=serum')).q).toBeUndefined();
  });

  it('keeps a sort only when it differs from the page default', () => {
    expect(parseListingParams('category', sp('sort=best_selling')).sort).toBeUndefined();
    expect(parseListingParams('new', sp('sort=newest')).sort).toBeUndefined();
    expect(parseListingParams('offers', sp('sort=discount')).sort).toBeUndefined();
    expect(parseListingParams('new', sp('sort=best_selling')).sort).toBe('best_selling');
    expect(parseListingParams('search', sp('q=serum&sort=relevance')).sort).toBeUndefined();
    expect(parseListingParams('search', sp('q=serum&sort=best_selling')).sort).toBe('best_selling');
    // Relevance needs search text.
    expect(parseListingParams('search', sp('sort=relevance')).sort).toBeUndefined();
    expect(parseListingParams('search', sp('sort=best_selling')).sort).toBeUndefined();
  });

  it('accepts every value of the shared enums', () => {
    for (const s of ShadeFamily.options) {
      expect(parseListingParams('search', sp(`shade=${s}`)).shade).toEqual([s]);
    }
    for (const s of SkinType.options) {
      expect(parseListingParams('search', sp(`skin=${s}`)).skin).toEqual([s]);
    }
    for (const t of SellerType.options) {
      expect(parseListingParams('search', sp(`type=${t}`)).type).toBe(t);
    }
    expect(Object.keys(SORT_LABEL).sort()).toEqual([...ProductSort.options].sort());
  });
});

describe('listing URLs', () => {
  it('round-trips: parse(build(p)) = p', () => {
    const cases: [Parameters<typeof parseListingParams>[0], ListingParams][] = [
      ['search', params()],
      ['search', params({ q: 'vitamin c', sort: 'price_desc', page: 3 })],
      [
        'search',
        params({
          q: 'lip',
          category: 'lips',
          brand: ['glow', 'velvet'],
          shade: ['red', 'berry'],
          skin: ['oily', 'dry'],
          type: 'vendor',
          min: 0,
          max: 12000,
          rating: 3,
          sale: true,
          sort: 'discount',
          page: 500,
        }),
      ],
      ['category', params({ brand: ['glow'], shade: ['nude'], sale: true, page: 2 })],
      ['offers', params({ category: 'eyes', sort: 'newest' })],
      ['brand', params({ category: 'face', rating: 4 })],
      ['store', params({ brand: ['rose-house'], min: 1500 })],
    ];
    for (const [kind, p] of cases) {
      expect(parseListingParams(kind, listingSearchParams(p))).toEqual(p);
    }
  });

  it('round-trips: build(parse(url)) = url for a URL in canonical order', () => {
    const url =
      'q=lip&brand=glow&brand=velvet&shade=red&min=1000&max=3000&rating=4&sale=1&sort=newest&page=2';
    expect(listingSearchParams(parseListingParams('search', sp(url))).toString()).toBe(url);
  });

  it('builds short URLs: nothing for defaults, page only from 2', () => {
    expect(listingHref('/new', params())).toBe('/new');
    expect(listingHref('/new', params({ page: 1 }))).toBe('/new');
    expect(listingHref('/new', params({ page: 2 }))).toBe('/new?page=2');
    expect(listingHref('/search', params({ q: 'rose & oud' }))).toBe('/search?q=rose+%26+oud');
  });

  it('goes back to page 1 when a filter or the sort changes', () => {
    const p = params({ brand: ['glow'], page: 3 });
    expect(withChange(p, { brand: ['glow', 'velvet'] })).toEqual(
      params({ brand: ['glow', 'velvet'] }),
    );
    expect(withChange(p, { sort: 'newest' }).page).toBe(1);
  });

  it('clears filters but keeps the search text and the sort', () => {
    const p = params({ q: 'serum', brand: ['glow'], sale: true, sort: 'rating', page: 2 });
    expect(cleared(p)).toEqual(params({ q: 'serum', sort: 'rating' }));
  });

  it('knows which URLs only narrow or reorder (not indexed)', () => {
    expect(hasFilterOrSort(params({ page: 4 }))).toBe(false);
    expect(hasFilterOrSort(params({ sort: 'newest' }))).toBe(true);
    expect(hasFilterOrSort(params({ sale: true }))).toBe(true);
    expect(hasFilterOrSort(params({ q: 'serum' }))).toBe(true);
  });

  it('offers Relevance only on a search with text', () => {
    expect(sortOptions('search', 'serum')[0]).toBe('relevance');
    expect(sortOptions('search')).not.toContain('relevance');
    expect(sortOptions('category')).toEqual([
      'best_selling',
      'newest',
      'price_asc',
      'price_desc',
      'rating',
      'discount',
    ]);
  });
});

describe('money in listing URLs', () => {
  it('turns whole rupees into paisa with integers only', () => {
    expect(rupeesToPaisa(0)).toBe(0);
    expect(rupeesToPaisa(1850)).toBe(185000);
    expect(rupeesToPaisa(10_000_000)).toBe(1_000_000_000);
    expect(() => rupeesToPaisa(12.5)).toThrow(RangeError);
    expect(() => rupeesToPaisa(-1)).toThrow(RangeError);
  });

  it('turns paisa into whole rupees for the price placeholders', () => {
    expect(paisaToRupees(185000)).toBe(1850);
    expect(paisaToRupees(185050)).toBe(1850);
    expect(paisaToRupees(185050, true)).toBe(1851);
    expect(paisaToRupees(185000, true)).toBe(1850);
  });

  it('sends paisa to the API', () => {
    const p = parseListingParams('search', sp('q=lipstick&min=1000&max=3000'));
    expect(toSearchQuery('search', p)).toEqual({
      q: 'lipstick',
      minPrice: 100000,
      maxPrice: 300000,
    });
  });
});

describe('toSearchQuery', () => {
  it('adds the page’s fixed filter and maps the param names', () => {
    const p = parseListingParams(
      'category',
      sp('brand=glow&shade=red&skin=dry&type=vendor&rating=4&sale=1&sort=rating&page=2'),
    );
    expect(toSearchQuery('category', p, { category: 'lips' })).toEqual({
      category: 'lips',
      brand: ['glow'],
      shade: ['red'],
      skinType: ['dry'],
      sellerType: 'vendor',
      minRating: 4,
      onSale: true,
      sort: 'rating',
      page: 2,
    });
  });

  it('asks for the default order of search, category, brand and store pages as no sort', () => {
    // No sort = relevance or best selling with sponsored products pinned (docs/p5-catalog.md §2.1).
    expect(toSearchQuery('category', params(), { category: 'lips' })).toEqual({ category: 'lips' });
    expect(toSearchQuery('search', params({ q: 'serum' }))).toEqual({ q: 'serum' });
    expect(toSearchQuery('new', params(), { isNew: true })).toEqual({
      isNew: true,
      sort: 'newest',
    });
    expect(toSearchQuery('offers', params(), { onSale: true })).toEqual({
      onSale: true,
      sort: 'discount',
    });
  });
});

describe('activeChips', () => {
  const facets: ProductFacets = {
    categories: [{ value: 'lips', label: 'Lips', count: 6 }],
    brands: [{ value: 'glow', label: 'Glow', count: 4 }],
    shades: [{ value: 'red', label: 'Red', count: 2, hex: '#B3122E' }],
    skinTypes: [{ value: 'dry', label: 'Dry', count: 1 }],
    sellerTypes: [{ value: 'vendor', label: 'Resellers', count: 3 }],
    ratings: [{ value: '4', label: '4 stars & up', count: 3 }],
    onSale: 2,
    price: { min: 65000, max: 1200000 },
  };

  it('makes one chip per value, labelled from the facets', () => {
    const p = params({
      q: 'lip',
      category: 'lips',
      brand: ['glow', 'unknown-brand'],
      shade: ['red'],
      skin: ['dry'],
      type: 'vendor',
      min: 1000,
      rating: 4,
      sale: true,
      sort: 'newest',
      page: 2,
    });
    const chips = activeChips(p, facets);
    expect(chips.map((c) => c.label)).toEqual([
      'Category: Lips',
      'Brand: Glow',
      'Brand: unknown-brand',
      'Shade: Red',
      'Skin: Dry',
      'Seller: Resellers',
      'Price: From Rs 1,000',
      'Rating: 4★ & up',
      'On sale',
    ]);
    expect(chips.find((c) => c.key === 'rating')?.name).toBe('Rating: 4 stars & up');
  });

  it('removes only its own value and goes back to page 1', () => {
    const p = params({ brand: ['glow', 'velvet'], min: 1000, max: 3000, sort: 'newest', page: 3 });
    const [glow, , price] = activeChips(p, facets);
    expect(glow?.without).toEqual(
      params({ brand: ['velvet'], min: 1000, max: 3000, sort: 'newest' }),
    );
    expect(price?.label).toBe('Price: Rs 1,000 – Rs 3,000');
    expect(price?.without).toEqual(params({ brand: ['glow', 'velvet'], sort: 'newest' }));
  });
});

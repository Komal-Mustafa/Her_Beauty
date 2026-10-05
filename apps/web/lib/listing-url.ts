import type {
  FacetOption,
  ProductFacets,
  ProductSort,
  SellerType,
  ShadeFamily,
  SkinType,
} from '@hb/types';

/*
 * Listing URLs (docs/p5-catalog.md §2.2): the filter state of a listing page as short,
 * human-readable search params, and back. No zod here: the filter panel imports this on the
 * client, and the header keeps classic zod out of the browser (lib/store-schemas.ts). Parsing a
 * URL, which needs validation, lives in listing-params.ts and runs on the server.
 */

/** The listing pages (docs/p5-catalog.md §1). */
export type ListingKind = 'category' | 'search' | 'new' | 'offers' | 'brand' | 'store';

/** A filter group a listing page offers. A page's own fixed filter is never one of its groups. */
export type ListingFilter =
  | 'category'
  | 'brand'
  | 'shade'
  | 'skin'
  | 'type'
  | 'price'
  | 'rating'
  | 'sale';

/** Filter groups per page, in panel order (docs/p5-catalog.md §1 "Facets shown"). */
export const LISTING_FILTERS: Record<ListingKind, readonly ListingFilter[]> = {
  category: ['brand', 'shade', 'skin', 'type', 'price', 'rating', 'sale'],
  search: ['category', 'brand', 'shade', 'skin', 'type', 'price', 'rating', 'sale'],
  new: ['category', 'brand', 'shade', 'skin', 'type', 'price', 'rating', 'sale'],
  offers: ['category', 'brand', 'shade', 'skin', 'type', 'price', 'rating'],
  brand: ['category', 'shade', 'skin', 'type', 'price', 'rating', 'sale'],
  store: ['category', 'brand', 'shade', 'skin', 'price', 'rating', 'sale'],
};

/** Listing products per page (SEARCH_PAGE_SIZE). */
export const LISTING_PAGE_SIZE = 24;
export const LISTING_PAGE_MAX = 500;
/** Longest search text (ProductQuery.q). */
export const LISTING_Q_MAX = 100;
/** Highest price filter in whole rupees (keeps paisa a safe integer). */
export const LISTING_RUPEES_MAX = 10_000_000;

/**
 * A listing page's state from its URL. Prices are whole rupees as typed; the API gets paisa
 * (`rupeesToPaisa`). `sort` is set only when it differs from the page's default order.
 */
export type ListingParams = {
  /** Search text (the search page only). */
  q?: string;
  category?: string;
  brand: string[];
  shade: ShadeFamily[];
  skin: SkinType[];
  type?: SellerType;
  min?: number;
  max?: number;
  rating?: 3 | 4;
  sale: boolean;
  sort?: ProductSort;
  page: number;
};

export const EMPTY_LISTING: ListingParams = {
  brand: [],
  shade: [],
  skin: [],
  sale: false,
  page: 1,
};

/** The order a page shows when the URL has no `sort`. */
export function defaultSort(kind: ListingKind, q?: string): ProductSort {
  if (kind === 'search') return q ? 'relevance' : 'best_selling';
  if (kind === 'new') return 'newest';
  if (kind === 'offers') return 'discount';
  return 'best_selling';
}

/**
 * The sort the API is asked for. The default order of search, category, brand and store pages is
 * sent as no sort at all: the API then orders by relevance or best selling and pins up to two
 * sponsored products to the top (docs/p5-catalog.md §2.1). An explicit sort is never overridden.
 */
export function apiSort(kind: ListingKind, params: ListingParams): ProductSort | undefined {
  if (params.sort) return params.sort;
  if (kind === 'new' || kind === 'offers') return defaultSort(kind);
  return undefined;
}

export const SORT_LABEL: Record<ProductSort, string> = {
  relevance: 'Relevance',
  best_selling: 'Bestselling',
  newest: 'Newest',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  rating: 'Top rated',
  discount: 'Biggest discount',
};

const SORT_ORDER: readonly ProductSort[] = [
  'relevance',
  'best_selling',
  'newest',
  'price_asc',
  'price_desc',
  'rating',
  'discount',
];

/** The Sort select's options: Relevance only on a search with text. */
export function sortOptions(kind: ListingKind, q?: string): ProductSort[] {
  return SORT_ORDER.filter((s) => s !== 'relevance' || (kind === 'search' && Boolean(q)));
}

/** "1 product", "1,250 products". */
export function productCount(n: number): string {
  return `${n.toLocaleString('en-PK')} ${n === 1 ? 'product' : 'products'}`;
}

/** Whole rupees from the URL → paisa for the API (integers only, rules.md §1.2). */
export function rupeesToPaisa(rupees: number): number {
  if (!Number.isSafeInteger(rupees) || rupees < 0) {
    throw new RangeError(`Rupees must be a non-negative integer, got ${rupees}`);
  }
  return rupees * 100;
}

/** Paisa → whole rupees, rounded down (`up` rounds up), with integer maths only. */
export function paisaToRupees(paisa: number, up = false): number {
  const rest = paisa % 100;
  const whole = (paisa - rest) / 100;
  return up && rest > 0 ? whole + 1 : whole;
}

/** A filter (not the text search, the sort or the page) is applied. */
export function hasFilters(p: ListingParams): boolean {
  return (
    p.category !== undefined ||
    p.brand.length > 0 ||
    p.shade.length > 0 ||
    p.skin.length > 0 ||
    p.type !== undefined ||
    p.min !== undefined ||
    p.max !== undefined ||
    p.rating !== undefined ||
    p.sale
  );
}

/** The URL narrows or reorders the page: such pages are not indexed (docs/p5-catalog.md §2.3). */
export function hasFilterOrSort(p: ListingParams): boolean {
  return p.q !== undefined || p.sort !== undefined || hasFilters(p);
}

/** Search params in a fixed order: q, category, brand…, shade…, skin…, type, min, max, rating, sale, sort, page. */
export function listingSearchParams(p: ListingParams): URLSearchParams {
  const out = new URLSearchParams();
  if (p.q) out.set('q', p.q);
  if (p.category) out.set('category', p.category);
  for (const b of p.brand) out.append('brand', b);
  for (const s of p.shade) out.append('shade', s);
  for (const s of p.skin) out.append('skin', s);
  if (p.type) out.set('type', p.type);
  if (p.min !== undefined) out.set('min', String(p.min));
  if (p.max !== undefined) out.set('max', String(p.max));
  if (p.rating !== undefined) out.set('rating', String(p.rating));
  if (p.sale) out.set('sale', '1');
  if (p.sort) out.set('sort', p.sort);
  if (p.page > 1) out.set('page', String(p.page));
  return out;
}

/** The page path with the params (no `?` when there are none). */
export function listingHref(path: string, p: ListingParams): string {
  const query = listingSearchParams(p).toString();
  return query ? `${path}?${query}` : path;
}

/** New filters or sort: always back to page 1. */
export function withChange(p: ListingParams, change: Partial<ListingParams>): ListingParams {
  return { ...p, ...change, page: 1 };
}

/** Ticks or unticks one value of a repeated filter. */
export function toggled<T extends string>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Every filter removed; the search text and the sort stay (they are not filters). */
export function cleared(p: ListingParams): ListingParams {
  return { ...EMPTY_LISTING, q: p.q, sort: p.sort };
}

export type ActiveChip = {
  /** Unique per chip, e.g. `brand:glow`. */
  key: string;
  /** "Brand: Glow" */
  label: string;
  /** The label as read out ("Rating: 4 stars & up" for "Rating: 4★ & up"). */
  name: string;
  /** The params without this value (page 1). */
  without: ListingParams;
};

const labelOf = (options: readonly FacetOption[], value: string) =>
  options.find((o) => o.value === value)?.label ?? value;

/** "Rs 1,500" (whole rupees). */
export function rupeesLabel(rupees: number): string {
  return `Rs ${rupees.toLocaleString('en-PK')}`;
}

function priceChipLabel(min: number | undefined, max: number | undefined): string {
  if (min !== undefined && max !== undefined) return `${rupeesLabel(min)} – ${rupeesLabel(max)}`;
  return min !== undefined ? `From ${rupeesLabel(min)}` : `Up to ${rupeesLabel(max ?? 0)}`;
}

/**
 * One chip per applied value (docs/p5-catalog.md §2.1 "Active chips"), labelled from the facets.
 * A page's fixed filter is not in the params, so it never becomes a chip.
 */
export function activeChips(p: ListingParams, facets: ProductFacets): ActiveChip[] {
  const chips: ActiveChip[] = [];
  const add = (key: string, label: string, change: Partial<ListingParams>, name = label) =>
    chips.push({ key, label, name, without: withChange(p, change) });

  if (p.category) {
    add(`category:${p.category}`, `Category: ${labelOf(facets.categories, p.category)}`, {
      category: undefined,
    });
  }
  for (const b of p.brand) {
    add(`brand:${b}`, `Brand: ${labelOf(facets.brands, b)}`, { brand: toggled(p.brand, b) });
  }
  for (const s of p.shade) {
    add(`shade:${s}`, `Shade: ${labelOf(facets.shades, s)}`, { shade: toggled(p.shade, s) });
  }
  for (const s of p.skin) {
    add(`skin:${s}`, `Skin: ${labelOf(facets.skinTypes, s)}`, { skin: toggled(p.skin, s) });
  }
  if (p.type)
    add(`type:${p.type}`, `Seller: ${labelOf(facets.sellerTypes, p.type)}`, { type: undefined });
  if (p.min !== undefined || p.max !== undefined) {
    add('price', `Price: ${priceChipLabel(p.min, p.max)}`, { min: undefined, max: undefined });
  }
  if (p.rating !== undefined) {
    add(
      'rating',
      `Rating: ${p.rating}★ & up`,
      { rating: undefined },
      `Rating: ${p.rating} stars & up`,
    );
  }
  if (p.sale) add('sale', 'On sale', { sale: false });
  return chips;
}

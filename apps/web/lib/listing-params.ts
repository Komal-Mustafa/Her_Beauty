import { ProductSort, SellerType, ShadeFamily, SkinType, Slug, type SearchQuery } from '@hb/types';
import { z } from 'zod';
import {
  apiSort,
  defaultSort,
  EMPTY_LISTING,
  LISTING_FILTERS,
  LISTING_PAGE_MAX,
  LISTING_Q_MAX,
  LISTING_RUPEES_MAX,
  rupeesToPaisa,
  type ListingFilter,
  type ListingKind,
  type ListingParams,
} from './listing-url';

export * from './listing-url';

/*
 * Lenient parsing of listing URLs (docs/p5-catalog.md §2.2). Each value is checked on its own with
 * zod and dropped when invalid, so a mistyped or stale link still shows a listing, never an error
 * page. Single-valued params take their first valid value; repeated ones keep every valid value
 * once, in URL order. Params the page does not offer (a brand on a brand page…) are ignored.
 */

/** What `searchParams` gives a page, or a URLSearchParams. */
export type RawParams = Record<string, string | string[] | undefined> | URLSearchParams;

/** Values of a repeated param kept at most (more cannot narrow a real listing further). */
const MAX_VALUES = 20;

const WholeRupees = z
  .string()
  .regex(/^\d{1,9}$/)
  .transform(Number)
  .pipe(z.number().int().min(0).max(LISTING_RUPEES_MAX));
const PageNumber = z
  .string()
  .regex(/^\d{1,4}$/)
  .transform(Number)
  .pipe(z.number().int().min(1).max(LISTING_PAGE_MAX));
const Rating = z.enum(['3', '4']).transform((v) => (v === '4' ? 4 : 3));
const OnSale = z.enum(['1', 'true']);

function values(raw: RawParams, key: string): string[] {
  if (raw instanceof URLSearchParams) return raw.getAll(key);
  const value = raw[key];
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

type Schema<T> = { safeParse(input: unknown): { success: true; data: T } | { success: false } };

/** The first value that passes. */
function first<T>(raw: RawParams, key: string, schema: Schema<T>): T | undefined {
  for (const value of values(raw, key)) {
    const parsed = schema.safeParse(value);
    if (parsed.success) return parsed.data;
  }
  return undefined;
}

/** Every value that passes, once each, in URL order. */
function every<T>(raw: RawParams, key: string, schema: Schema<T>): T[] {
  const out: T[] = [];
  for (const value of values(raw, key)) {
    const parsed = schema.safeParse(value);
    if (parsed.success && !out.includes(parsed.data)) out.push(parsed.data);
    if (out.length === MAX_VALUES) break;
  }
  return out;
}

/** Trimmed search text, cut to 100 characters; empty means no search. */
function searchText(raw: RawParams): string | undefined {
  for (const value of values(raw, 'q')) {
    const q = value.trim().slice(0, LISTING_Q_MAX).trim();
    if (q) return q;
  }
  return undefined;
}

/** The listing state of a page from its URL; anything invalid or not offered there is dropped. */
export function parseListingParams(kind: ListingKind, raw: RawParams): ListingParams {
  const offers = (filter: ListingFilter) => LISTING_FILTERS[kind].includes(filter);
  const q = kind === 'search' ? searchText(raw) : undefined;
  const p: ListingParams = { ...EMPTY_LISTING, page: first(raw, 'page', PageNumber) ?? 1 };
  if (q) p.q = q;

  if (offers('category')) p.category = first(raw, 'category', Slug);
  if (offers('brand')) p.brand = every(raw, 'brand', Slug);
  if (offers('shade')) p.shade = every(raw, 'shade', ShadeFamily);
  if (offers('skin')) p.skin = every(raw, 'skin', SkinType);
  if (offers('type')) p.type = first(raw, 'type', SellerType);
  if (offers('price')) {
    const min = first(raw, 'min', WholeRupees);
    const max = first(raw, 'max', WholeRupees);
    // "From 3000 to 1000" means 1000 to 3000.
    const swap = min !== undefined && max !== undefined && min > max;
    p.min = swap ? max : min;
    p.max = swap ? min : max;
  }
  if (offers('rating')) p.rating = first(raw, 'rating', Rating);
  if (offers('sale')) p.sale = first(raw, 'sale', OnSale) !== undefined;

  // Relevance needs search text; the page's own default order is the same as no sort.
  const sort = first(raw, 'sort', ProductSort);
  const relevanceOk = sort !== 'relevance' || q !== undefined;
  if (sort && relevanceOk && sort !== defaultSort(kind, q)) p.sort = sort;

  // Unset optional fields are left off, so a parsed URL equals one built by hand.
  for (const key of ['category', 'type', 'min', 'max', 'rating'] as const) {
    if (p[key] === undefined) delete p[key];
  }
  return p;
}

/**
 * The GET /search query for a page: its fixed filter (`fixed`, e.g. `{ category: 'lips' }`)
 * plus the URL's filters, prices in paisa, the sort from `apiSort` and the page number.
 */
export function toSearchQuery(
  kind: ListingKind,
  p: ListingParams,
  fixed: SearchQuery = {},
): SearchQuery {
  const query: SearchQuery = {
    ...fixed,
    q: p.q,
    category: p.category ?? fixed.category,
    brand: p.brand.length ? p.brand : fixed.brand,
    shade: p.shade.length ? p.shade : undefined,
    skinType: p.skin.length ? p.skin : undefined,
    sellerType: p.type ?? fixed.sellerType,
    minPrice: p.min === undefined ? undefined : rupeesToPaisa(p.min),
    maxPrice: p.max === undefined ? undefined : rupeesToPaisa(p.max),
    minRating: p.rating,
    onSale: p.sale ? true : fixed.onSale,
    sort: apiSort(kind, p),
    page: p.page > 1 ? p.page : undefined,
  };
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined),
  ) as SearchQuery;
}

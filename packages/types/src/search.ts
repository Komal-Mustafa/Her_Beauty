import {
  SEARCH_PAGE_SIZE,
  SEARCH_SPONSORED_PINS,
  SellerType,
  ShadeFamily,
  SkinType,
  type FacetOption,
  type Product,
  type ProductCard,
  type ProductFacets,
  type ProductQuery,
  type ProductSort,
  type SearchQuery,
  type SearchResult,
} from './catalog';
import { discountPercent } from './money';

/*
 * Shared catalogue logic (docs/p5-catalog.md §4). Pure: the mock adapter and the API both run
 * these over the same products, so mock mode and http mode list, count and order the same way.
 * The API feeds products newest first; ties in every sort keep that input order.
 */

// ---------- text matching ----------

/** Lowercase, strip accents (Lumière → lumiere), `&` → and, other symbols → single spaces. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Words of a text after `normalizeText`. */
export function tokenize(text: string): string[] {
  const normalized = normalizeText(text);
  return normalized ? normalized.split(' ') : [];
}

/**
 * Damerau–Levenshtein distance (optimal string alignment: insert, delete, substitute, swap two
 * neighbours). Stops early and returns `max + 1` once the distance must exceed `max`.
 */
export function damerauLevenshtein(a: string, b: string, max = Infinity): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let before: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min((prev[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d = Math.min(d, (before[j - 2] ?? 0) + 1);
      }
      row.push(d);
      rowMin = Math.min(rowMin, d);
    }
    if (rowMin > max) return max + 1;
    before = prev;
    prev = row;
  }
  return prev[b.length] ?? 0;
}

/** Typos a query word may have: none under 4 letters, 1 for 4–7, 2 from 8. */
export function allowedTypos(length: number): number {
  return length >= 8 ? 2 : length >= 4 ? 1 : 0;
}

/** The searchable text of a product. */
export type SearchDoc = {
  title: string;
  brand: string;
  store: string;
  category: string;
  tags: readonly string[];
  shades: readonly string[];
};

/** How much a match in each field counts. */
export const SEARCH_FIELD_WEIGHTS = {
  title: 4,
  brand: 3,
  category: 2,
  tags: 2,
  shades: 1,
  store: 1,
} as const satisfies Record<keyof SearchDoc, number>;

/** An exact word beats a prefix (type-ahead), which beats a typo. */
const MATCH_QUALITY = { exact: 3, prefix: 2, typo: 1 } as const;

type IndexedDoc = { weight: number; words: readonly string[] }[];

function indexDoc(doc: SearchDoc): IndexedDoc {
  const words = (texts: readonly string[]) => [...new Set(texts.flatMap(tokenize))];
  return (Object.keys(SEARCH_FIELD_WEIGHTS) as (keyof SearchDoc)[]).map((field) => {
    const value = doc[field];
    return {
      weight: SEARCH_FIELD_WEIGHTS[field],
      words: words(typeof value === 'string' ? [value] : value),
    };
  });
}

function wordMatch(term: string, word: string, prefixOk: boolean): number {
  if (term === word) return MATCH_QUALITY.exact;
  if (prefixOk && word.startsWith(term)) return MATCH_QUALITY.prefix;
  const typos = allowedTypos(term.length);
  return typos > 0 && damerauLevenshtein(term, word, typos) <= typos ? MATCH_QUALITY.typo : 0;
}

/** Every term must match some word (AND); the score adds each term's best weighted match. */
function scoreTerms(terms: readonly string[], doc: IndexedDoc): number {
  let score = 0;
  for (const [i, term] of terms.entries()) {
    // Prefix matching only for the word being typed (the last one), from 2 letters.
    const prefixOk = i === terms.length - 1 && term.length >= 2;
    let best = 0;
    for (const field of doc) {
      for (const word of field.words) {
        best = Math.max(best, wordMatch(term, word, prefixOk) * field.weight);
      }
    }
    if (best === 0) return 0;
    score += best;
  }
  return score;
}

/**
 * Relevance of a product to a search: every query word must match a word of the product exactly,
 * by prefix (the last query word, from 2 letters) or with typos (`allowedTypos`). The score is
 * the sum of each word's best match times its field weight (`SEARCH_FIELD_WEIGHTS`), exact
 * above prefix above typo. 0 = no match (also for a query without words).
 */
export function searchScore(query: string, doc: SearchDoc): number {
  const terms = tokenize(query);
  return terms.length ? scoreTerms(terms, indexDoc(doc)) : 0;
}

// ---------- shade families ----------

/** Swatch colour drawn for each family in the shade filter. */
export const SHADE_FAMILY_HEX: Record<ShadeFamily, string> = {
  nude: '#C98A7A',
  pink: '#E75A9B',
  red: '#B3122E',
  berry: '#8E1B4F',
  coral: '#E5675C',
  mauve: '#B8738C',
  brown: '#7B4A3A',
  gold: '#D4AF37',
};

export const SHADE_FAMILY_LABEL: Record<ShadeFamily, string> = {
  nude: 'Nude',
  pink: 'Pink',
  red: 'Red',
  berry: 'Berry',
  coral: 'Coral',
  mauve: 'Mauve',
  brown: 'Brown',
  gold: 'Gold',
};

/** Hue (degrees), saturation and lightness (0–1) of a `#RRGGBB` colour. */
function toHsl(hex: string): { h: number; s: number; l: number } {
  const n = Number.parseInt(hex.slice(1, 7), 16) || 0;
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const sector = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: sector * 60, s, l };
}

/**
 * The family a person would name a shade by (Berry Kiss → berry, Nude Silk → nude, Coral Bloom →
 * coral, a gold highlighter → gold). Rules on HSL: near-black and greys are brown or nude;
 * yellow-orange hues are gold when saturated; around red, muted tones are mauve (pink side),
 * brown (dark) or nude (light), saturated ones pink or berry (dark) on the magenta side, red or
 * coral (light) at red, coral or brown (dark) towards orange, and pale peach is nude. Greens and
 * blues, rare on a lip or cheek chart, count as mauve. Expects `#RRGGBB`.
 */
export function shadeFamily(hex: string): ShadeFamily {
  const { h, s, l } = toHsl(hex);
  if (l < 0.15 || s < 0.12) return l < 0.6 ? 'brown' : 'nude';
  if (h >= 30 && h < 75) return s >= 0.45 && l >= 0.35 ? 'gold' : l >= 0.55 ? 'nude' : 'brown';
  if (h >= 75 && h < 250) return 'mauve';
  if (h >= 250 && h < 320) return l < 0.35 ? 'berry' : 'mauve';
  // Warm hues around red: -40 (magenta side) … 0 (red) … 30 (orange side).
  const w = h >= 320 ? h - 360 : h;
  if (s < 0.5) {
    if (w < -10) return l < 0.35 ? 'berry' : 'mauve';
    return l < 0.5 ? 'brown' : 'nude';
  }
  if (w < -15) return l < 0.36 ? 'berry' : 'pink';
  if (w < 6) return l >= 0.55 ? 'coral' : 'red';
  if (l >= 0.8) return 'nude';
  return l >= 0.45 ? 'coral' : 'brown';
}

// ---------- money ----------

// The discount rule lives in ./money (no zod) so the sale badge can import it on its own.
export { discountPercent };

/** On sale = the compare-at price is above the price. */
export function isOnSale(p: Pick<ProductCard, 'price' | 'compareAtPrice'>): boolean {
  return p.compareAtPrice !== null && p.compareAtPrice > p.price;
}

// ---------- filters, sort, facets, pages ----------

/** Category rows the logic needs: slug for filters and facets, name for text search. */
export type CategoryRef = { id: string; slug: string; name: string };

/** What the products alone do not carry. */
export type SearchContext = { categories: readonly CategoryRef[] };

/** The filter part of a ProductQuery or SearchQuery. */
export type ProductFilters = Omit<ProductQuery, 'sort' | 'cursor' | 'limit'>;

/** Filters with a facet: counted without their own filter (disjunctive facets). */
type FacetGroup =
  | 'category'
  | 'brand'
  | 'shade'
  | 'skinType'
  | 'sellerType'
  | 'rating'
  | 'onSale'
  | 'price';

type Check = { group: FacetGroup | null; test: (p: Product) => boolean };

type Prepared = { checks: Check[]; scores: Map<string, number> | null; family: FamilyOf };

type FamilyOf = (hex: string) => ShadeFamily;

/** shadeFamily with a per-call cache (products share shades). */
function familyCache(): FamilyOf {
  const cache = new Map<string, ShadeFamily>();
  return (hex) => {
    let family = cache.get(hex);
    if (!family) {
      family = shadeFamily(hex);
      cache.set(hex, family);
    }
    return family;
  };
}

/** The SearchDoc of a product: category name from the context, shade names from its variants. */
export function searchDoc(p: Product, ctx: SearchContext): SearchDoc {
  return {
    title: p.title,
    brand: p.brand.name,
    store: p.seller.storeName,
    category: ctx.categories.find((c) => c.id === p.categoryId)?.name ?? '',
    tags: p.tags,
    shades: p.shades.map((s) => s.name),
  };
}

function prepare(
  products: readonly Product[],
  query: ProductFilters,
  ctx: SearchContext,
): Prepared {
  const family = familyCache();
  const terms = tokenize(query.q ?? '');
  const scores = terms.length
    ? new Map(products.map((p) => [p.id, scoreTerms(terms, indexDoc(searchDoc(p, ctx)))]))
    : null;
  const checks: Check[] = [];
  const add = (group: FacetGroup | null, test: Check['test']) => checks.push({ group, test });

  if (scores) add(null, (p) => (scores.get(p.id) ?? 0) > 0);
  if (query.category !== undefined) {
    const id = ctx.categories.find((c) => c.slug === query.category)?.id;
    add('category', (p) => id !== undefined && p.categoryId === id);
  }
  if (query.brand?.length) {
    const brands = new Set(query.brand);
    add('brand', (p) => brands.has(p.brand.slug));
  }
  if (query.seller !== undefined) add(null, (p) => p.seller.slug === query.seller);
  if (query.sellerType !== undefined) add('sellerType', (p) => p.seller.type === query.sellerType);
  if (query.skinType?.length) {
    const skin = new Set(query.skinType);
    add('skinType', (p) => p.skinTypes.some((s) => skin.has(s)));
  }
  if (query.shade?.length) {
    const shades = new Set(query.shade);
    add('shade', (p) => p.shades.some((s) => shades.has(family(s.hex))));
  }
  const { minPrice, maxPrice, minRating, onSale, isNew } = query;
  if (minPrice !== undefined || maxPrice !== undefined) {
    add(
      'price',
      (p) =>
        (minPrice === undefined || p.price >= minPrice) &&
        (maxPrice === undefined || p.price <= maxPrice),
    );
  }
  if (minRating !== undefined) add('rating', (p) => p.rating >= minRating);
  if (onSale !== undefined) add('onSale', (p) => isOnSale(p) === onSale);
  if (isNew !== undefined) add(null, (p) => p.isNew === isNew);
  if (query.ids?.length) {
    const ids = new Set(query.ids);
    add(null, (p) => ids.has(p.id));
  }
  return { checks, scores, family };
}

const passes = (p: Product, { checks }: Prepared) => checks.every((c) => c.test(p));

/** The products that pass every filter of the query (text, fixed page filters and facets). */
export function filterProducts(
  products: readonly Product[],
  query: ProductFilters,
  ctx: SearchContext,
): Product[] {
  const prepared = prepare(products, query, ctx);
  return products.filter((p) => passes(p, prepared));
}

/**
 * Orders products; ties keep the input order. relevance = score desc (input order without
 * scores), newest = new products first, rating = stars then number of ratings, best_selling =
 * sold count, discount = % off then cheapest. Without a sort the input order is kept.
 */
export function sortProducts(
  list: readonly Product[],
  sort: ProductSort | undefined,
  scores?: ReadonlyMap<string, number>,
): Product[] {
  const copy = [...list];
  const by = (compare: (a: Product, b: Product) => number) => copy.sort(compare);
  switch (sort) {
    case 'relevance':
      return scores ? by((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0)) : copy;
    case 'newest':
      return by((a, b) => Number(b.isNew) - Number(a.isNew));
    case 'price_asc':
      return by((a, b) => a.price - b.price);
    case 'price_desc':
      return by((a, b) => b.price - a.price);
    case 'rating':
      return by((a, b) => b.rating - a.rating || b.ratingCount - a.ratingCount);
    case 'best_selling':
      return by((a, b) => b.soldCount - a.soldCount);
    case 'discount':
      return by(
        (a, b) =>
          discountPercent(b.price, b.compareAtPrice) - discountPercent(a.price, a.compareAtPrice) ||
          a.price - b.price,
      );
    default:
      return copy;
  }
}

/**
 * Moves the first `max` sponsored products to the front and keeps everything else in order.
 * Runs on the whole ordered list before paging, so a pinned product never shows twice.
 */
export function pinSponsored<T extends { sponsored: boolean }>(
  list: readonly T[],
  max: number = SEARCH_SPONSORED_PINS,
): T[] {
  const pinned: T[] = [];
  const rest: T[] = [];
  for (const item of list) (item.sponsored && pinned.length < max ? pinned : rest).push(item);
  return [...pinned, ...rest];
}

/**
 * Filtered products in display order. Without an explicit sort: `ids` order when ids are given,
 * else relevance with a text query and best selling without, with up to SEARCH_SPONSORED_PINS
 * sponsored products first (also for an explicit `relevance`). Relevance without a text query
 * orders as best selling.
 */
function ordered(
  products: readonly Product[],
  query: ProductFilters & { sort?: ProductSort },
  prepared: Prepared,
): Product[] {
  const matched = products.filter((p) => passes(p, prepared));
  if (query.ids?.length && query.sort === undefined) {
    const rank = new Map(query.ids.map((id, i) => [id, i] as const).reverse());
    return matched.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  }
  const { scores } = prepared;
  const sort = query.sort === 'relevance' || query.sort === undefined ? 'relevance' : query.sort;
  const list = sortProducts(
    matched,
    sort === 'relevance' && !scores ? 'best_selling' : sort,
    scores ?? undefined,
  );
  return sort === 'relevance' ? pinSponsored(list) : list;
}

/** `getProducts`: filter, then order (see `ordered`), before the caller pages with its cursor. */
export function selectProducts(
  products: readonly Product[],
  query: ProductFilters & { sort?: ProductSort },
  ctx: SearchContext,
): Product[] {
  return ordered(products, query, prepare(products, query, ctx));
}

const SKIN_TYPE_LABEL: Record<SkinType, string> = {
  dry: 'Dry',
  oily: 'Oily',
  combination: 'Combination',
  normal: 'Normal',
  sensitive: 'Sensitive',
};

const SELLER_TYPE_LABEL: Record<SellerType, string> = {
  vendor: 'Resellers',
  manufacturer: 'Official brand stores',
};

/** Star thresholds of the rating facet ("4 stars & up"). */
const RATING_STEPS = [4, 3] as const;

function facetsOf(products: readonly Product[], prepared: Prepared, ctx: SearchContext) {
  const tally = new Map<string, number>();
  const bump = (key: string) => tally.set(key, (tally.get(key) ?? 0) + 1);
  const count = (key: string) => tally.get(key) ?? 0;
  const brands = new Map<string, string>();
  let price: { min: number; max: number } | null = null;

  for (const p of products) {
    brands.set(p.brand.slug, p.brand.name);
    // A product counts for a group when it passes every filter except (at most) that group's.
    let failed: FacetGroup | null | undefined;
    let failures = 0;
    for (const check of prepared.checks) {
      if (check.test(p)) continue;
      failures += 1;
      failed = check.group;
      if (failures > 1 || failed === null) break;
    }
    if (failures > 1 || failed === null) continue;
    const counts = (group: FacetGroup) => failures === 0 || failed === group;

    if (counts('category')) bump(`category:${p.categoryId}`);
    if (counts('brand')) bump(`brand:${p.brand.slug}`);
    if (counts('shade')) {
      for (const f of new Set(p.shades.map((s) => prepared.family(s.hex)))) bump(`shade:${f}`);
    }
    if (counts('skinType')) for (const s of new Set(p.skinTypes)) bump(`skin:${s}`);
    if (counts('sellerType')) bump(`seller:${p.seller.type}`);
    if (counts('rating')) for (const n of RATING_STEPS) if (p.rating >= n) bump(`rating:${n}`);
    if (counts('onSale') && isOnSale(p)) bump('onSale');
    if (counts('price')) {
      price = price
        ? { min: Math.min(price.min, p.price), max: Math.max(price.max, p.price) }
        : { min: p.price, max: p.price };
    }
  }

  const option = (value: string, label: string, key: string): FacetOption => ({
    value,
    label,
    count: count(key),
  });
  const facets: ProductFacets = {
    categories: ctx.categories.map((c) => option(c.slug, c.name, `category:${c.id}`)),
    brands: [...brands]
      .sort(([slugA, a], [slugB, b]) => a.localeCompare(b, 'en') || (slugA < slugB ? -1 : 1))
      .map(([slug, name]) => option(slug, name, `brand:${slug}`)),
    shades: ShadeFamily.options.map((f) => ({
      ...option(f, SHADE_FAMILY_LABEL[f], `shade:${f}`),
      hex: SHADE_FAMILY_HEX[f],
    })),
    skinTypes: SkinType.options.map((s) => option(s, SKIN_TYPE_LABEL[s], `skin:${s}`)),
    sellerTypes: SellerType.options.map((t) => option(t, SELLER_TYPE_LABEL[t], `seller:${t}`)),
    ratings: RATING_STEPS.map((n) => option(String(n), `${n} stars & up`, `rating:${n}`)),
    onSale: count('onSale'),
    price,
  };
  return facets;
}

/**
 * Disjunctive facets: each group counts the products that pass every other filter, so ticking a
 * second brand keeps both brands' counts. `price` is the range with every filter except price.
 * Fixed page filters (the category of a category page…) are passed like any other filter.
 * Options come from the context (categories), the products (brands) or the enums, count 0 or not.
 */
export function computeFacets(
  products: readonly Product[],
  query: ProductFilters,
  ctx: SearchContext,
): ProductFacets {
  return facetsOf(products, prepare(products, query, ctx), ctx);
}

/** A Product without its detail-page fields. */
export function toProductCard(p: Product): ProductCard {
  const {
    descriptionHtml: _d,
    howToUse: _h,
    ingredients: _i,
    skinTypes: _s,
    tags: _t,
    variants: _v,
    media: _m,
    soldCount: _c,
    ...card
  } = p;
  return card;
}

/**
 * The listing engine behind GET /search: filter → score → sort → pin sponsored → page, plus the
 * facets. A page past the end has no items and still reports the real total.
 */
export function runSearch(
  products: readonly Product[],
  query: SearchQuery,
  ctx: SearchContext,
): SearchResult {
  const prepared = prepare(products, query, ctx);
  const list = ordered(products, query, prepared);
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? SEARCH_PAGE_SIZE;
  const start = (page - 1) * pageSize;
  return {
    items: list.slice(start, start + pageSize).map(toProductCard),
    total: list.length,
    page,
    pageSize,
    pageCount: Math.ceil(list.length / pageSize),
    facets: facetsOf(products, prepared, ctx),
  };
}

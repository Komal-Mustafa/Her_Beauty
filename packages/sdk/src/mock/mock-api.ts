import { featuredReviewLimit, type HbApi } from '../api';
import { ApiRequestError, sentFields } from '../http/http-api';
import {
  estimateDelivery,
  PkCity,
  ProductQuery,
  runSearch,
  SearchQuery,
  selectProducts,
  Slug,
  toProductCard,
  type Product,
  type SearchContext,
} from '@hb/types';
import {
  adPackages,
  brands,
  categories,
  heroScenes,
  products,
  reviews,
  sellingPlans,
  servedAds,
  shippingProfiles,
  sponsoredProductSlugs,
  stores,
} from './fixtures';
import { featuredBrands, featuredReviews, storefrontStats } from './home-fixtures';

const DEFAULT_LIMIT = 24;

/**
 * The live catalogue as the API loads it: sponsored products flagged, newest first (the seed
 * dates new products after the rest, in fixture order), so ties sort the same in both adapters.
 */
const catalogue: Product[] = products
  .map((p) => ({ ...p, sponsored: sponsoredProductSlugs.includes(p.slug) }))
  .sort((a, b) => Number(b.isNew) - Number(a.isNew));

const ctx: SearchContext = { categories };

const categorySlugOfProduct = new Map(
  products.map((p) => [p.slug, categories.find((c) => c.id === p.categoryId)?.slug]),
);

type Schema<T> = { safeParse(input: unknown): { success: true; data: T } | { success: false } };

/** Same check and error code as the API edge, so a bad query fails alike in both modes. */
function validate<T>(schema: Schema<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ApiRequestError(400, 'VALIDATION_FAILED', 'Some fields are invalid.');
  }
  return result.data;
}

// Strict, as the controller parses them: a field the endpoint does not take is a 400, not dropped.
const StrictProductQuery = ProductQuery.strict();
const StrictSearchQuery = SearchQuery.strict();

/** In-memory implementation of HbApi. Async to match the real HTTP client. */
export const mockApi: HbApi = {
  async getCategories() {
    return categories;
  },
  async getCategory(slug) {
    return categories.find((c) => c.slug === slug) ?? null;
  },
  async getBrands() {
    return brands;
  },
  async getBrand(slug) {
    return brands.find((b) => b.slug === slug) ?? null;
  },
  async getProducts(query = {}) {
    const q = validate(StrictProductQuery, sentFields(query));
    const limit = q.limit ?? DEFAULT_LIMIT;
    const start = q.cursor ? Number.parseInt(q.cursor, 10) || 0 : 0;
    const list = selectProducts(catalogue, q, ctx);
    const next = start + limit < list.length ? String(start + limit) : null;
    return { items: list.slice(start, start + limit).map(toProductCard), nextCursor: next };
  },
  async search(query = {}) {
    return runSearch(catalogue, validate(StrictSearchQuery, sentFields(query)), ctx);
  },
  async getProduct(slug) {
    return catalogue.find((p) => p.slug === slug) ?? null;
  },
  async getDeliveryEstimate(productSlug, city) {
    const to = validate(PkCity, city);
    const slug = validate(Slug, productSlug);
    const product = catalogue.find((p) => p.slug === slug);
    if (!product) return null;
    const store = stores.find((s) => s.id === product.seller.id);
    return estimateDelivery(store?.city ?? '', to, shippingProfiles[product.seller.id]);
  },
  async getReviews(productId) {
    return reviews.filter((r) => r.productId === productId);
  },
  async getStore(slug) {
    return stores.find((s) => s.slug === slug) ?? null;
  },
  async getStores() {
    return stores;
  },
  async getAdSlots(slot, opts) {
    const ads = servedAds.filter((a) => a.slot === slot);
    if (slot !== 'category_banner' || !opts?.category) return ads;
    // A category banner is booked in the slot of its product's category (as the seed does).
    return ads.filter(
      (a) => a.productSlug !== null && categorySlugOfProduct.get(a.productSlug) === opts.category,
    );
  },
  async getHeroScenes() {
    return heroScenes;
  },
  async getAdPackages() {
    return adPackages;
  },
  async getSellingPlans() {
    return sellingPlans;
  },
  async getStorefrontStats() {
    return storefrontStats;
  },
  async getFeaturedReviews(limit) {
    return featuredReviews(featuredReviewLimit(limit));
  },
  async getFeaturedBrands() {
    return featuredBrands;
  },
};

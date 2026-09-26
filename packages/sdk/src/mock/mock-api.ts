import type { HbApi } from '../api';
import type { Product, ProductCard, ProductQuery } from '@hb/types';
import {
  adPackages,
  brands,
  categories,
  heroScenes,
  products,
  reviews,
  sellingPlans,
  servedAds,
  sponsoredProductSlugs,
  stores,
} from './fixtures';

const DEFAULT_LIMIT = 24;

function toCard(p: Product): ProductCard {
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

function matches(p: Product, q: ProductQuery): boolean {
  const categoryId = q.category ? categories.find((c) => c.slug === q.category)?.id : undefined;
  if (q.category && p.categoryId !== categoryId) return false;
  if (q.brand?.length && !q.brand.includes(p.brand.slug)) return false;
  if (q.seller && p.seller.slug !== q.seller) return false;
  if (q.sellerType && p.seller.type !== q.sellerType) return false;
  if (q.skinType?.length && !q.skinType.some((s) => p.skinTypes.includes(s))) return false;
  if (q.minPrice !== undefined && p.price < q.minPrice) return false;
  if (q.maxPrice !== undefined && p.price > q.maxPrice) return false;
  if (q.minRating !== undefined && p.rating < q.minRating) return false;
  if (q.q) {
    const needle = q.q.toLowerCase();
    const hay = `${p.title} ${p.brand.name} ${p.seller.storeName}`.toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
}

function sortProducts(list: Product[], sort: ProductQuery['sort']): Product[] {
  const copy = [...list];
  switch (sort) {
    case 'newest':
      return copy.sort((a, b) => Number(b.isNew) - Number(a.isNew));
    case 'price_asc':
      return copy.sort((a, b) => a.price - b.price);
    case 'price_desc':
      return copy.sort((a, b) => b.price - a.price);
    case 'rating':
      return copy.sort((a, b) => b.rating - a.rating);
    case 'best_selling':
      return copy.sort((a, b) => b.soldCount - a.soldCount);
    default:
      return copy;
  }
}

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
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, 100);
    const start = query.cursor ? Number.parseInt(query.cursor, 10) || 0 : 0;
    const filtered = sortProducts(
      products.filter((p) => matches(p, query)),
      query.sort,
    );
    const pageItems = filtered.slice(start, start + limit).map((p) => ({
      ...toCard(p),
      sponsored: sponsoredProductSlugs.includes(p.slug),
    }));
    const next = start + limit < filtered.length ? String(start + limit) : null;
    return { items: pageItems, nextCursor: next };
  },
  async getProduct(slug) {
    return products.find((p) => p.slug === slug) ?? null;
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
  async getAdSlots(slot) {
    return servedAds.filter((a) => a.slot === slot);
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
};

import type {
  AdPackage,
  AdSlotCode,
  Brand,
  Category,
  FeaturedBrand,
  FeaturedReview,
  HeroScene,
  Paged,
  Product,
  ProductCard,
  ProductQuery,
  Review,
  SellingPlan,
  ServedAd,
  Store,
  StorefrontStats,
} from '@hb/types';
import { FEATURED_REVIEWS_DEFAULT, FEATURED_REVIEWS_MAX } from '@hb/types';

/**
 * Every screen reads data through this interface. Today it is backed by mocks;
 * later an HTTP adapter calls the NestJS API (02-trd §5.1) with the same signatures.
 */
export interface HbApi {
  getCategories(): Promise<Category[]>;
  getCategory(slug: string): Promise<Category | null>;
  getBrands(): Promise<Brand[]>;
  getBrand(slug: string): Promise<Brand | null>;
  getProducts(query?: ProductQuery): Promise<Paged<ProductCard>>;
  getProduct(slug: string): Promise<Product | null>;
  getReviews(productId: string): Promise<Review[]>;
  getStore(slug: string): Promise<Store | null>;
  getStores(): Promise<Store[]>;
  /** GET /ads/serve?slot= — returns ads to rotate in a slot (may be empty). */
  getAdSlots(slot: AdSlotCode, opts?: { category?: string }): Promise<ServedAd[]>;
  getHeroScenes(): Promise<HeroScene[]>;
  getAdPackages(): Promise<AdPackage[]>;
  getSellingPlans(): Promise<SellingPlan[]>;
  /** GET /stats/storefront — home trust counters (sellers, official brands, products, orders). */
  getStorefrontStats(): Promise<StorefrontStats>;
  /**
   * GET /reviews/featured?limit= — newest 4–5 star verified reviews of live products, one per
   * shopper, so there may be fewer than `limit`.
   * `limit` is clamped to 1–12 (default 3) by both adapters, see `featuredReviewLimit`.
   */
  getFeaturedReviews(limit?: number): Promise<FeaturedReview[]>;
  /** GET /brands/featured — Icon ("top") then Luxe ("featured") brands; render "Sponsored". */
  getFeaturedBrands(): Promise<FeaturedBrand[]>;
}

/** The mock and HTTP adapters clamp the same way, so both return the same number of reviews. */
export function featuredReviewLimit(limit: number = FEATURED_REVIEWS_DEFAULT): number {
  if (!Number.isFinite(limit)) return FEATURED_REVIEWS_DEFAULT;
  return Math.min(FEATURED_REVIEWS_MAX, Math.max(1, Math.trunc(limit)));
}

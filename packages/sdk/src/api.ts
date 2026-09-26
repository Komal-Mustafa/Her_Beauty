import type {
  AdPackage,
  AdSlotCode,
  Brand,
  Category,
  HeroScene,
  Paged,
  Product,
  ProductCard,
  ProductQuery,
  Review,
  SellingPlan,
  ServedAd,
  Store,
} from '@hb/types';

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
}

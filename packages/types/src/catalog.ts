import { z } from 'zod';
import { Asset, HexColor, Id, IsoDateTime, Money, Slug, Currency } from './common';

// Mirrors docs/05-database-schema.md §catalog (products, product_variants, product_media).

export const Category = z.object({
  id: Id,
  slug: Slug,
  name: z.string(),
  image: Asset,
  parentId: Id.nullable(),
});
export type Category = z.infer<typeof Category>;

export const SellerType = z.enum(['vendor', 'manufacturer']);
export type SellerType = z.infer<typeof SellerType>;

export const SellerBadge = z.enum(['verified_seller', 'official_brand']);
export type SellerBadge = z.infer<typeof SellerBadge>;

export const Brand = z.object({
  id: Id,
  slug: Slug,
  name: z.string(),
  logo: Asset,
  isProtected: z.boolean(),
  /** Manufacturer that owns the brand, if it sells on HB. */
  ownerSellerId: Id.nullable(),
});
export type Brand = z.infer<typeof Brand>;

export const SellerSummary = z.object({
  id: Id,
  slug: Slug,
  storeName: z.string(),
  type: SellerType,
  badge: SellerBadge,
  logo: Asset,
  city: z.string(),
  rating: z.number().min(0).max(5),
});
export type SellerSummary = z.infer<typeof SellerSummary>;

export const Store = SellerSummary.extend({
  banner: Asset,
  about: z.string(),
  joinedAt: IsoDateTime,
  productCount: z.number().int().nonnegative(),
});
export type Store = z.infer<typeof Store>;

export const MediaType = z.enum(['image', 'video', 'model3d']);
export type MediaType = z.infer<typeof MediaType>;

export const ProductMedia = z.object({
  id: Id,
  type: MediaType,
  url: z.string(),
  posterUrl: z.string().nullable(),
  alt: z.string(),
  /** Procedural 3D fallback kind when no .glb exists yet. */
  model3dKind: z.enum(['lipstick', 'compact', 'perfume', 'jar']).nullable(),
});
export type ProductMedia = z.infer<typeof ProductMedia>;

export const Variant = z.object({
  id: Id,
  sku: z.string(),
  shadeName: z.string().nullable(),
  shadeHex: HexColor.nullable(),
  sizeLabel: z.string().nullable(),
  price: Money,
  compareAtPrice: Money.nullable(),
  currency: Currency,
  stock: z.number().int().nonnegative(),
});
export type Variant = z.infer<typeof Variant>;

export const SkinType = z.enum(['dry', 'oily', 'combination', 'normal', 'sensitive']);
export type SkinType = z.infer<typeof SkinType>;

export const ProductCard = z.object({
  id: Id,
  slug: Slug,
  title: z.string().max(200),
  brand: Brand.pick({ id: true, slug: true, name: true }),
  seller: SellerSummary.pick({ id: true, slug: true, storeName: true, type: true, badge: true }),
  categoryId: Id,
  images: z.array(Asset).min(1),
  price: Money,
  compareAtPrice: Money.nullable(),
  currency: Currency,
  shades: z.array(z.object({ name: z.string(), hex: HexColor })),
  rating: z.number().min(0).max(5),
  ratingCount: z.number().int().nonnegative(),
  has3d: z.boolean(),
  hasVideo: z.boolean(),
  isNew: z.boolean(),
  /** True when shown because of a paid sponsored_product slot — must render "Sponsored". */
  sponsored: z.boolean(),
  /**
   * One-click "Add to cart" target: the product's only variant, while it is in stock. Null when
   * the shopper must pick a shade or size on the product page (or nothing is in stock).
   */
  quickAddVariantId: Id.nullable(),
});
export type ProductCard = z.infer<typeof ProductCard>;

export const Product = ProductCard.extend({
  descriptionHtml: z.string(),
  howToUse: z.string().nullable(),
  ingredients: z.string().nullable(),
  skinTypes: z.array(SkinType),
  tags: z.array(z.string()),
  variants: z.array(Variant).min(1),
  media: z.array(ProductMedia),
  soldCount: z.number().int().nonnegative(),
});
export type Product = z.infer<typeof Product>;

export const Review = z.object({
  id: Id,
  productId: Id,
  authorName: z.string(),
  rating: z.number().int().min(1).max(5),
  title: z.string(),
  body: z.string(),
  photos: z.array(Asset),
  verifiedPurchase: z.literal(true), // rules.md §5: reviews only from verified purchases
  createdAt: IsoDateTime,
});
export type Review = z.infer<typeof Review>;

export const ProductSort = z.enum([
  'relevance',
  'newest',
  'price_asc',
  'price_desc',
  'rating',
  'best_selling',
]);
export type ProductSort = z.infer<typeof ProductSort>;

export const ProductQuery = z.object({
  q: z.string().max(100).optional(),
  category: Slug.optional(),
  brand: z.array(Slug).optional(),
  seller: Slug.optional(),
  sellerType: SellerType.optional(),
  skinType: z.array(SkinType).optional(),
  minPrice: Money.optional(),
  maxPrice: Money.optional(),
  minRating: z.number().min(0).max(5).optional(),
  sort: ProductSort.optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
export type ProductQuery = z.infer<typeof ProductQuery>;

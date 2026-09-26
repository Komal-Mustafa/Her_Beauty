import type { Prisma } from '@hb/db';
import type {
  Brand,
  Category,
  Product,
  ProductCard,
  Review,
  SellerSummary,
  Store,
} from '@hb/types';
import { mediaUrl, money, proceduralKind } from '../common/media';

export const sellerSelect = {
  id: true,
  slug: true,
  storeName: true,
  type: true,
  city: true,
  logoKey: true,
  bannerKey: true,
  about: true,
  approvedAt: true,
  createdAt: true,
  ownedBrands: { select: { isProtected: true } },
} satisfies Prisma.SellerSelect;

export type SellerRow = Prisma.SellerGetPayload<{ select: typeof sellerSelect }>;

export const productInclude = {
  brand: true,
  seller: { select: sellerSelect },
  variants: { where: { isActive: true }, orderBy: { price: 'asc' } },
  media: { where: { status: 'ready' }, orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.ProductInclude;

export type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

const NEW_FOR_DAYS = 30;

export function toCategory(c: {
  id: string;
  slug: string;
  name: string;
  iconKey: string | null;
  parentId: string | null;
}): Category {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    image: { url: mediaUrl(c.iconKey), alt: c.name },
    parentId: c.parentId,
  };
}

export function toBrand(b: {
  id: string;
  slug: string;
  name: string;
  logoKey: string | null;
  isProtected: boolean;
  ownerSellerId: string | null;
}): Brand {
  return {
    id: b.id,
    slug: b.slug,
    name: b.name,
    logo: { url: mediaUrl(b.logoKey), alt: `${b.name} logo` },
    isProtected: b.isProtected,
    ownerSellerId: b.ownerSellerId,
  };
}

/** A manufacturer that owns a protected brand shows "Official brand" (PRD §7.3). */
export function toSellerSummary(s: SellerRow, rating: number): SellerSummary {
  const official = s.type === 'manufacturer' && s.ownedBrands.some((b) => b.isProtected);
  return {
    id: s.id,
    slug: s.slug ?? s.id,
    storeName: s.storeName ?? '',
    type: s.type,
    badge: official ? 'official_brand' : 'verified_seller',
    logo: { url: mediaUrl(s.logoKey), alt: `${s.storeName ?? ''} logo` },
    city: s.city ?? '',
    rating,
  };
}

export function toStore(s: SellerRow, rating: number, productCount: number): Store {
  return {
    ...toSellerSummary(s, rating),
    banner: { url: mediaUrl(s.bannerKey), alt: `${s.storeName ?? ''} banner` },
    about: s.about ?? '',
    joinedAt: (s.approvedAt ?? s.createdAt).toISOString(),
    productCount,
  };
}

export function toProduct(p: ProductRow, sellerRating: number, sponsored: boolean): Product {
  const cheapest = p.variants[0];
  const images = p.media.filter((m) => m.type === 'image');
  const firstImage = images[0];
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    brand: { id: p.brand.id, slug: p.brand.slug, name: p.brand.name },
    seller: (({ id, slug, storeName, type, badge }) => ({ id, slug, storeName, type, badge }))(
      toSellerSummary(p.seller, sellerRating),
    ),
    categoryId: p.categoryId,
    images: images.length
      ? images.map((m) => ({
          url: mediaUrl(m.fileKey),
          alt: m.altText ?? p.title,
          ...(m.width ? { width: m.width } : {}),
          ...(m.height ? { height: m.height } : {}),
        }))
      : [
          {
            url: firstImage ? mediaUrl(firstImage.fileKey) : '/placeholders/brand-mark.svg',
            alt: p.title,
          },
        ],
    price: cheapest ? money(cheapest.price) : 0,
    compareAtPrice: cheapest?.compareAtPrice != null ? money(cheapest.compareAtPrice) : null,
    currency: cheapest?.currency === 'USD' ? 'USD' : 'PKR',
    shades: p.variants
      .filter((v) => v.shadeName && v.shadeHex)
      .map((v) => ({ name: v.shadeName ?? '', hex: v.shadeHex ?? '' })),
    rating: Number(p.ratingAvg),
    ratingCount: p.ratingCount,
    has3d: p.has3d,
    hasVideo: p.hasVideo,
    isNew: Date.now() - p.createdAt.getTime() < NEW_FOR_DAYS * 86_400_000,
    sponsored,
    descriptionHtml: p.descriptionHtml ?? '',
    howToUse: p.howToUse,
    ingredients: p.ingredients,
    skinTypes: p.skinTypes.filter((s): s is Product['skinTypes'][number] =>
      ['dry', 'oily', 'combination', 'normal', 'sensitive'].includes(s),
    ),
    tags: p.tags,
    variants: p.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      shadeName: v.shadeName,
      shadeHex: v.shadeHex,
      sizeLabel: v.sizeLabel,
      price: money(v.price),
      compareAtPrice: v.compareAtPrice != null ? money(v.compareAtPrice) : null,
      currency: v.currency === 'USD' ? 'USD' : 'PKR',
      stock: v.stock,
    })),
    media: p.media.map((m) => ({
      id: m.id,
      type: m.type,
      url: mediaUrl(m.fileKey),
      posterUrl: m.posterKey ? mediaUrl(m.posterKey) : null,
      alt: m.altText ?? p.title,
      model3dKind: m.type === 'model3d' ? proceduralKind(m.fileKey) : null,
    })),
    soldCount: p.soldCount,
  };
}

export function toCard(p: Product): ProductCard {
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

export function toReview(r: {
  id: string;
  productId: string;
  rating: number;
  title: string | null;
  body: string | null;
  photoKeys: string[];
  createdAt: Date;
  customer: { fullName: string };
}): Review {
  // Show first name + initial only (privacy).
  const [first = 'Customer', last] = r.customer.fullName.trim().split(/\s+/);
  return {
    id: r.id,
    productId: r.productId,
    authorName: last ? `${first} ${last[0]}.` : first,
    rating: r.rating,
    title: r.title ?? '',
    body: r.body ?? '',
    photos: r.photoKeys.map((k) => ({ url: mediaUrl(k), alt: 'Customer photo' })),
    verifiedPurchase: true,
    createdAt: r.createdAt.toISOString(),
  };
}

import type {
  AdPackage,
  Brand,
  Category,
  HeroScene,
  Product,
  ProductMedia,
  Review,
  SellingPlan,
  ServedAd,
  SkinType,
  Store,
} from '@hb/types';
import { rupees } from '../format';

/*
 * Mock catalogue for UI development. Numbers for plans and ad packages come from
 * docs/01-prd.md §7.5–7.6 and are still [CONFIRM] with the client.
 * Images are local SVG placeholders under each app's /public/placeholders.
 */

type Kind = 'lipstick' | 'compact' | 'perfume' | 'jar' | 'serum' | 'palette';

const img = (kind: Kind, alt: string, variant = 1) => ({
  url: `/placeholders/${kind}-${variant}.svg`,
  alt,
  width: 800,
  height: 1000,
});

const logo = (alt: string) => ({
  url: '/placeholders/brand-mark.svg',
  alt,
  width: 200,
  height: 200,
});

export const categories: Category[] = [
  {
    id: 'cat-lips',
    slug: 'lips',
    name: 'Lips',
    image: img('lipstick', 'Lipsticks'),
    parentId: null,
  },
  {
    id: 'cat-face',
    slug: 'face',
    name: 'Face',
    image: img('compact', 'Blush and powder'),
    parentId: null,
  },
  {
    id: 'cat-eyes',
    slug: 'eyes',
    name: 'Eyes',
    image: img('palette', 'Eyeshadow palettes'),
    parentId: null,
  },
  {
    id: 'cat-skincare',
    slug: 'skincare',
    name: 'Skincare',
    image: img('serum', 'Serums'),
    parentId: null,
  },
  {
    id: 'cat-fragrance',
    slug: 'fragrance',
    name: 'Fragrance',
    image: img('perfume', 'Perfumes'),
    parentId: null,
  },
  { id: 'cat-body', slug: 'body', name: 'Body', image: img('jar', 'Body creams'), parentId: null },
  {
    id: 'cat-hair',
    slug: 'hair',
    name: 'Hair',
    image: img('serum', 'Hair oils', 2),
    parentId: null,
  },
  {
    id: 'cat-tools',
    slug: 'tools',
    name: 'Tools',
    image: img('palette', 'Brushes and tools', 2),
    parentId: null,
  },
];

export const stores: Store[] = [
  {
    id: 'sel-glow',
    slug: 'glow-cosmetics',
    storeName: 'Glow Cosmetics',
    type: 'manufacturer',
    badge: 'official_brand',
    logo: logo('Glow Cosmetics'),
    city: 'Lahore',
    rating: 4.8,
    banner: img('lipstick', 'Glow Cosmetics banner', 2),
    about: 'Lahore-made lipsticks and blush, cruelty-free since 2019.',
    joinedAt: '2026-01-12T00:00:00.000Z',
    productCount: 14,
  },
  {
    id: 'sel-beautypoint',
    slug: 'beauty-point',
    storeName: 'Beauty Point',
    type: 'vendor',
    badge: 'verified_seller',
    logo: logo('Beauty Point'),
    city: 'Karachi',
    rating: 4.6,
    banner: img('palette', 'Beauty Point banner'),
    about: 'Authorised stockist of 20 international and local brands.',
    joinedAt: '2026-02-03T00:00:00.000Z',
    productCount: 300,
  },
  {
    id: 'sel-rosehouse',
    slug: 'rose-house',
    storeName: 'Rose House',
    type: 'manufacturer',
    badge: 'official_brand',
    logo: logo('Rose House'),
    city: 'Islamabad',
    rating: 4.9,
    banner: img('perfume', 'Rose House banner'),
    about: 'Fine fragrances distilled from Pakistani damask roses.',
    joinedAt: '2026-03-18T00:00:00.000Z',
    productCount: 9,
  },
  {
    id: 'sel-skinlab',
    slug: 'skin-lab',
    storeName: 'Skin Lab PK',
    type: 'vendor',
    badge: 'verified_seller',
    logo: logo('Skin Lab PK'),
    city: 'Lahore',
    rating: 4.5,
    banner: img('serum', 'Skin Lab banner'),
    about: 'Dermatologist-picked skincare, shipped in 48 hours.',
    joinedAt: '2026-04-09T00:00:00.000Z',
    productCount: 120,
  },
  {
    id: 'sel-velvet',
    slug: 'velvet-studio',
    storeName: 'Velvet Studio',
    type: 'manufacturer',
    badge: 'official_brand',
    logo: logo('Velvet Studio'),
    city: 'Faisalabad',
    rating: 4.7,
    banner: img('compact', 'Velvet Studio banner', 2),
    about: 'Soft-matte face products for South Asian skin tones.',
    joinedAt: '2026-05-21T00:00:00.000Z',
    productCount: 22,
  },
];

export const brands: Brand[] = [
  {
    id: 'br-glow',
    slug: 'glow',
    name: 'Glow',
    logo: logo('Glow'),
    isProtected: true,
    ownerSellerId: 'sel-glow',
  },
  {
    id: 'br-rose',
    slug: 'rose-house',
    name: 'Rose House',
    logo: logo('Rose House'),
    isProtected: true,
    ownerSellerId: 'sel-rosehouse',
  },
  {
    id: 'br-velvet',
    slug: 'velvet',
    name: 'Velvet',
    logo: logo('Velvet'),
    isProtected: true,
    ownerSellerId: 'sel-velvet',
  },
  {
    id: 'br-lumiere',
    slug: 'lumiere',
    name: 'Lumière',
    logo: logo('Lumière'),
    isProtected: false,
    ownerSellerId: null,
  },
  {
    id: 'br-dewy',
    slug: 'dewy',
    name: 'Dewy',
    logo: logo('Dewy'),
    isProtected: false,
    ownerSellerId: null,
  },
  {
    id: 'br-saffron',
    slug: 'saffron',
    name: 'Saffron & Co',
    logo: logo('Saffron & Co'),
    isProtected: false,
    ownerSellerId: null,
  },
];

const LIP_SHADES = [
  { name: 'Berry Kiss', hex: '#8E1B4F' },
  { name: 'Rose Petal', hex: '#C2185B' },
  { name: 'Nude Silk', hex: '#C98A7A' },
  { name: 'Coral Bloom', hex: '#E5675C' },
];
const BLUSH_SHADES = [
  { name: 'Peony', hex: '#F4A6C0' },
  { name: 'Apricot', hex: '#F2A07B' },
  { name: 'Mauve', hex: '#B8738C' },
];

type Seed = {
  slug: string;
  title: string;
  kind: Kind;
  brandId: string;
  sellerId: string;
  categoryId: string;
  price: number;
  compareAt?: number;
  shades?: { name: string; hex: string }[];
  has3d?: boolean;
  hasVideo?: boolean;
  isNew?: boolean;
  rating: number;
  ratingCount: number;
  skin?: SkinType[];
};

const seeds: Seed[] = [
  {
    slug: 'velvet-matte-lipstick',
    title: 'Velvet Matte Lipstick',
    kind: 'lipstick',
    brandId: 'br-glow',
    sellerId: 'sel-glow',
    categoryId: 'cat-lips',
    price: 1850,
    compareAt: 2200,
    shades: LIP_SHADES,
    has3d: true,
    hasVideo: true,
    rating: 4.8,
    ratingCount: 214,
  },
  {
    slug: 'satin-glow-lipstick',
    title: 'Satin Glow Lipstick',
    kind: 'lipstick',
    brandId: 'br-glow',
    sellerId: 'sel-glow',
    categoryId: 'cat-lips',
    price: 1650,
    shades: LIP_SHADES.slice(1),
    has3d: true,
    isNew: true,
    rating: 4.7,
    ratingCount: 88,
  },
  {
    slug: 'silk-lip-oil',
    title: 'Silk Lip Oil',
    kind: 'serum',
    brandId: 'br-dewy',
    sellerId: 'sel-beautypoint',
    categoryId: 'cat-lips',
    price: 1200,
    rating: 4.4,
    ratingCount: 51,
    isNew: true,
  },
  {
    slug: 'peony-blush-compact',
    title: 'Peony Blush Compact',
    kind: 'compact',
    brandId: 'br-velvet',
    sellerId: 'sel-velvet',
    categoryId: 'cat-face',
    price: 2400,
    compareAt: 2900,
    shades: BLUSH_SHADES,
    has3d: true,
    hasVideo: true,
    rating: 4.9,
    ratingCount: 167,
  },
  {
    slug: 'soft-focus-powder',
    title: 'Soft Focus Pressed Powder',
    kind: 'compact',
    brandId: 'br-velvet',
    sellerId: 'sel-velvet',
    categoryId: 'cat-face',
    price: 2100,
    has3d: true,
    rating: 4.6,
    ratingCount: 73,
    skin: ['oily', 'combination'],
  },
  {
    slug: 'lumiere-highlighter',
    title: 'Lumière Gold Highlighter',
    kind: 'compact',
    brandId: 'br-lumiere',
    sellerId: 'sel-beautypoint',
    categoryId: 'cat-face',
    price: 2750,
    rating: 4.5,
    ratingCount: 40,
    isNew: true,
  },
  {
    slug: 'rose-dusk-palette',
    title: 'Rose Dusk Eyeshadow Palette',
    kind: 'palette',
    brandId: 'br-lumiere',
    sellerId: 'sel-beautypoint',
    categoryId: 'cat-eyes',
    price: 3900,
    compareAt: 4500,
    hasVideo: true,
    rating: 4.7,
    ratingCount: 129,
  },
  {
    slug: 'gilded-eyes-palette',
    title: 'Gilded Eyes Palette',
    kind: 'palette',
    brandId: 'br-saffron',
    sellerId: 'sel-beautypoint',
    categoryId: 'cat-eyes',
    price: 3400,
    rating: 4.3,
    ratingCount: 36,
  },
  {
    slug: 'vitamin-c-glow-serum',
    title: 'Vitamin C Glow Serum',
    kind: 'serum',
    brandId: 'br-dewy',
    sellerId: 'sel-skinlab',
    categoryId: 'cat-skincare',
    price: 2950,
    compareAt: 3500,
    hasVideo: true,
    rating: 4.8,
    ratingCount: 302,
    skin: ['normal', 'dry', 'combination'],
  },
  {
    slug: 'hyaluronic-dew-serum',
    title: 'Hyaluronic Dew Serum',
    kind: 'serum',
    brandId: 'br-dewy',
    sellerId: 'sel-skinlab',
    categoryId: 'cat-skincare',
    price: 2650,
    rating: 4.6,
    ratingCount: 190,
    isNew: true,
    skin: ['dry', 'sensitive'],
  },
  {
    slug: 'rose-water-cream',
    title: 'Rose Water Night Cream',
    kind: 'jar',
    brandId: 'br-rose',
    sellerId: 'sel-rosehouse',
    categoryId: 'cat-skincare',
    price: 3200,
    has3d: true,
    rating: 4.9,
    ratingCount: 98,
    skin: ['dry', 'normal'],
  },
  {
    slug: 'damask-rose-eau-de-parfum',
    title: 'Damask Rose Eau de Parfum',
    kind: 'perfume',
    brandId: 'br-rose',
    sellerId: 'sel-rosehouse',
    categoryId: 'cat-fragrance',
    price: 8500,
    compareAt: 9800,
    has3d: true,
    hasVideo: true,
    rating: 4.9,
    ratingCount: 76,
  },
  {
    slug: 'oud-blush-parfum',
    title: 'Oud Blush Parfum',
    kind: 'perfume',
    brandId: 'br-rose',
    sellerId: 'sel-rosehouse',
    categoryId: 'cat-fragrance',
    price: 9900,
    has3d: true,
    isNew: true,
    rating: 4.8,
    ratingCount: 22,
  },
  {
    slug: 'saffron-body-butter',
    title: 'Saffron Body Butter',
    kind: 'jar',
    brandId: 'br-saffron',
    sellerId: 'sel-beautypoint',
    categoryId: 'cat-body',
    price: 1950,
    rating: 4.4,
    ratingCount: 64,
  },
  {
    slug: 'argan-hair-elixir',
    title: 'Argan Hair Elixir',
    kind: 'serum',
    brandId: 'br-saffron',
    sellerId: 'sel-skinlab',
    categoryId: 'cat-hair',
    price: 1750,
    rating: 4.5,
    ratingCount: 112,
  },
  {
    slug: 'gold-kabuki-brush',
    title: 'Gold Kabuki Brush',
    kind: 'palette',
    brandId: 'br-lumiere',
    sellerId: 'sel-beautypoint',
    categoryId: 'cat-tools',
    price: 1450,
    rating: 4.6,
    ratingCount: 58,
  },
];

const storeById = new Map(stores.map((s) => [s.id, s]));
const brandById = new Map(brands.map((b) => [b.id, b]));

function mediaFor(seed: Seed): ProductMedia[] {
  const list: ProductMedia[] = [1, 2].map((n) => ({
    id: `${seed.slug}-img-${n}`,
    type: 'image',
    url: `/placeholders/${seed.kind}-${n}.svg`,
    posterUrl: null,
    alt: `${seed.title}, view ${n}`,
    model3dKind: null,
  }));
  if (seed.hasVideo) {
    list.push({
      id: `${seed.slug}-video`,
      type: 'video',
      url: '/placeholders/video-placeholder.mp4', // [CONFIRM] real videos come from Stream/Mux
      posterUrl: `/placeholders/${seed.kind}-2.svg`,
      alt: `${seed.title} video`,
      model3dKind: null,
    });
  }
  if (seed.has3d) {
    const kind3d =
      seed.kind === 'lipstick' ||
      seed.kind === 'compact' ||
      seed.kind === 'perfume' ||
      seed.kind === 'jar'
        ? seed.kind
        : null;
    list.push({
      id: `${seed.slug}-3d`,
      type: 'model3d',
      url: '',
      posterUrl: null,
      alt: `3D view of ${seed.title}`,
      model3dKind: kind3d,
    });
  }
  return list;
}

function toProduct(seed: Seed, index: number): Product {
  const store = storeById.get(seed.sellerId);
  const brand = brandById.get(seed.brandId);
  if (!store || !brand) throw new Error(`Bad fixture: ${seed.slug}`);
  const shades = seed.shades ?? [];
  const variants = (shades.length ? shades : [null]).map((shade, i) => ({
    id: `${seed.slug}-v${i + 1}`,
    sku: `${seed.slug.toUpperCase().slice(0, 12)}-${i + 1}`,
    shadeName: shade?.name ?? null,
    shadeHex: shade?.hex ?? null,
    sizeLabel: seed.kind === 'perfume' ? '50 ml' : seed.kind === 'lipstick' ? '3.5 g' : null,
    price: rupees(seed.price),
    compareAtPrice: seed.compareAt ? rupees(seed.compareAt) : null,
    currency: 'PKR' as const,
    stock: i === 2 ? 0 : 25 + i * 5,
  }));
  return {
    id: `prd-${index + 1}`,
    slug: seed.slug,
    title: seed.title,
    brand: { id: brand.id, slug: brand.slug, name: brand.name },
    seller: {
      id: store.id,
      slug: store.slug,
      storeName: store.storeName,
      type: store.type,
      badge: store.badge,
    },
    categoryId: seed.categoryId,
    images: [img(seed.kind, seed.title, 1), img(seed.kind, `${seed.title}, alternate view`, 2)],
    price: rupees(seed.price),
    compareAtPrice: seed.compareAt ? rupees(seed.compareAt) : null,
    currency: 'PKR',
    shades,
    rating: seed.rating,
    ratingCount: seed.ratingCount,
    has3d: seed.has3d ?? false,
    hasVideo: seed.hasVideo ?? false,
    isNew: seed.isNew ?? false,
    sponsored: false,
    quickAddVariantId:
      variants.length === 1 && (variants[0]?.stock ?? 0) > 0 ? (variants[0]?.id ?? null) : null,
    descriptionHtml: `<p>${seed.title} by ${brand.name}. Crafted for a soft, luminous finish that lasts all day.</p>`,
    howToUse: 'Apply evenly and build up for more intensity.',
    ingredients: 'Full ingredient list provided by the seller. [CONFIRM]',
    skinTypes: seed.skin ?? [],
    tags: [seed.kind],
    variants,
    media: mediaFor(seed),
    soldCount: seed.ratingCount * 3,
  };
}

export const products: Product[] = seeds.map(toProduct);

/** Demo shoppers and what they said (the seed makes one account per author). */
const REVIEW_VOICES = [
  {
    authorName: 'Ayesha K.',
    rating: 5,
    title: 'Looks exactly like the pictures',
    body: 'Beautiful packaging and the colour is perfect for everyday wear.',
  },
  {
    authorName: 'Sana R.',
    rating: 4,
    title: 'Genuine product, fast delivery',
    body: 'Arrived in three days and was sealed. Would buy again.',
  },
  {
    authorName: 'Mehwish A.',
    rating: 5,
    title: 'Lasts through a long day',
    body: 'Wore it from a morning class to a family dinner and it still looked fresh.',
  },
  {
    authorName: 'Hira S.',
    rating: 5,
    title: 'My new favourite',
    body: 'Gentle on my skin and it suits my undertone. The seller packed it with real care.',
  },
  {
    authorName: 'Fatima Z.',
    rating: 4,
    title: 'Worth every rupee',
    body: 'Good quality for the price, and knowing my payment was protected made ordering easy.',
  },
] as const;

/**
 * Two reviews on each of the first six products, from different shoppers. Each product's first
 * review is from the last week, so the newest reviews are spread across products and shoppers.
 */
export const reviews: Review[] = products.slice(0, 6).flatMap((p, i) =>
  [i % REVIEW_VOICES.length, (i + 2) % REVIEW_VOICES.length].map((v, k) => {
    const voice = REVIEW_VOICES[v] ?? REVIEW_VOICES[0];
    return {
      id: `rev-${i}-${k + 1}`,
      productId: p.id,
      ...voice,
      photos: [],
      verifiedPurchase: true as const,
      createdAt: `2026-09-${20 - k * 10 + i}T10:00:00.000Z`,
    };
  }),
);

export const adPackages: AdPackage[] = [
  {
    id: 'pkg-glow',
    code: 'glow',
    name: 'Glow',
    priceMonthly: rupees(15000),
    seatsTotal: null,
    seatsTaken: 34,
    sponsoredProductsLimit: 3,
    impressionsQuota: 20000,
    slotDays: { category_banner: 0, right_video: 0, left_3d: 0, hero: 0, sponsored_product: 30 },
    featuredBrand: 'none',
    popular: false,
  },
  {
    id: 'pkg-radiance',
    code: 'radiance',
    name: 'Radiance',
    priceMonthly: rupees(40000),
    seatsTotal: 20,
    seatsTaken: 13,
    sponsoredProductsLimit: 10,
    impressionsQuota: 75000,
    slotDays: { category_banner: 7, right_video: 7, left_3d: 0, hero: 0, sponsored_product: 30 },
    featuredBrand: 'none',
    popular: true,
  },
  {
    id: 'pkg-luxe',
    code: 'luxe',
    name: 'Luxe',
    priceMonthly: rupees(90000),
    seatsTotal: 8,
    seatsTaken: 6,
    sponsoredProductsLimit: 25,
    impressionsQuota: 200000,
    slotDays: { category_banner: 14, right_video: 14, left_3d: 14, hero: 0, sponsored_product: 30 },
    featuredBrand: 'yes',
    popular: false,
  },
  {
    id: 'pkg-icon',
    code: 'icon',
    name: 'Icon',
    priceMonthly: rupees(200000),
    seatsTotal: 3,
    seatsTaken: 2,
    sponsoredProductsLimit: null,
    impressionsQuota: 500000,
    slotDays: {
      category_banner: 30,
      right_video: 30,
      left_3d: 30,
      hero: 30,
      sponsored_product: 30,
    },
    featuredBrand: 'top',
    popular: false,
  },
];

export const sellingPlans: SellingPlan[] = [
  {
    id: 'plan-standard',
    code: 'standard',
    name: 'Standard',
    priceMonthly: rupees(2500),
    productLimit: 8,
    imagesPerProduct: 5,
    video: false,
    model3d: false,
    staffLogins: 1,
    commissionBps: 1500,
    adDiscountBps: 0,
  },
  {
    id: 'plan-business',
    code: 'business',
    name: 'Business',
    priceMonthly: rupees(7500),
    productLimit: 50,
    imagesPerProduct: 10,
    video: true,
    model3d: false,
    staffLogins: 3,
    commissionBps: 1200,
    adDiscountBps: 500,
  },
  {
    id: 'plan-enterprise',
    code: 'enterprise',
    name: 'Enterprise',
    priceMonthly: rupees(20000),
    productLimit: null,
    imagesPerProduct: 15,
    video: true,
    model3d: true,
    staffLogins: 10,
    commissionBps: 1000,
    adDiscountBps: 1000,
  },
];

export const servedAds: ServedAd[] = [
  {
    id: 'ad-hero-1',
    slot: 'hero',
    sellerName: 'Rose House',
    headline: 'Damask Rose Eau de Parfum',
    ctaLabel: 'Shop now',
    href: '/product/damask-rose-eau-de-parfum',
    productSlug: 'damask-rose-eau-de-parfum',
    media: {
      kind: 'model3d',
      url: '',
      posterUrl: '/placeholders/perfume-1.svg',
      model3dKind: 'perfume',
      shadeHex: null,
    },
  },
  {
    id: 'ad-left-1',
    slot: 'left_3d',
    sellerName: 'Glow Cosmetics',
    headline: 'Velvet Matte Lipstick',
    ctaLabel: 'Discover shades',
    href: '/product/velvet-matte-lipstick',
    productSlug: 'velvet-matte-lipstick',
    media: {
      kind: 'model3d',
      url: '',
      posterUrl: '/placeholders/lipstick-1.svg',
      model3dKind: 'lipstick',
      shadeHex: '#C2185B',
    },
  },
  {
    id: 'ad-left-2',
    slot: 'left_3d',
    sellerName: 'Velvet Studio',
    headline: 'Peony Blush Compact',
    ctaLabel: 'Shop blush',
    href: '/product/peony-blush-compact',
    productSlug: 'peony-blush-compact',
    media: {
      kind: 'model3d',
      url: '',
      posterUrl: '/placeholders/compact-1.svg',
      model3dKind: 'compact',
      shadeHex: '#F4A6C0',
    },
  },
  {
    id: 'ad-right-1',
    slot: 'right_video',
    sellerName: 'Skin Lab PK',
    headline: 'Vitamin C Glow Serum',
    ctaLabel: 'Watch & shop',
    href: '/product/vitamin-c-glow-serum',
    productSlug: 'vitamin-c-glow-serum',
    media: {
      kind: 'video',
      // Loop rendered from our 3D stage (apps/web/scripts/render-ad-loop.mjs). WebM/VP9: the
      // headless Chromium encoder has no H.264. [CONFIRM] real videos come from Stream/Mux.
      url: '/placeholders/video-placeholder.webm',
      posterUrl: '/placeholders/serum-1.svg',
      model3dKind: null,
      shadeHex: null,
    },
  },
  {
    id: 'ad-right-2',
    slot: 'right_video',
    sellerName: 'Rose House',
    headline: 'Oud Blush Parfum',
    ctaLabel: 'Discover the scent',
    href: '/product/oud-blush-parfum',
    productSlug: 'oud-blush-parfum',
    media: {
      kind: 'video',
      url: '/placeholders/video-placeholder.webm',
      // The light (-1) posters share the ad media box's backdrop, so they sit seamlessly in-feed.
      posterUrl: '/placeholders/perfume-1.svg',
      model3dKind: null,
      shadeHex: null,
    },
  },
  {
    id: 'ad-banner-1',
    slot: 'category_banner',
    sellerName: 'Beauty Point',
    headline: 'Rose Dusk Palette — 13% off this week',
    ctaLabel: 'Shop the palette',
    href: '/product/rose-dusk-palette',
    productSlug: 'rose-dusk-palette',
    media: {
      kind: 'image',
      url: '/placeholders/palette-2.svg',
      posterUrl: null,
      model3dKind: null,
      shadeHex: null,
    },
  },
];

/** Sponsored product slugs (sponsored_product slot). Rendered with a "Sponsored" label. */
export const sponsoredProductSlugs = ['rose-dusk-palette', 'vitamin-c-glow-serum'];

export const heroScenes: HeroScene[] = [
  {
    id: 'hero-1',
    sortOrder: 1,
    title: 'Her Beauty, Her Story',
    subtitle: 'Genuine beauty from verified sellers, protected until it reaches you.',
    poster: {
      url: '/placeholders/hero-poster.svg',
      alt: 'A gold lipstick and blush compact on a soft blush background',
      width: 1600,
      height: 900,
    },
    ad: servedAds[0] ?? null,
    startsAt: null,
    endsAt: null,
  },
];

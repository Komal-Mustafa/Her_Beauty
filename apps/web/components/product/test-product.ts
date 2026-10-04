import type { Product, ProductMedia, Review, Variant } from '@hb/types';

/*
 * Small, fixed products for the product page's unit tests. They do not come from the SDK fixtures,
 * which grow with the catalogue.
 */

const variant = (n: number, over: Partial<Variant> = {}): Variant => ({
  id: `velvet-v${n}`,
  sku: `VELVET-${n}`,
  shadeName: null,
  shadeHex: null,
  sizeLabel: null,
  price: 185000,
  compareAtPrice: 220000,
  currency: 'PKR',
  stock: 25,
  ...over,
});

const image = (n: number, alt: string): ProductMedia => ({
  id: `img-${n}`,
  type: 'image',
  url: `/placeholders/lipstick-${n}.svg`,
  posterUrl: null,
  alt,
  model3dKind: null,
});

export const SHADES = [
  { name: 'Berry Kiss', hex: '#8E1B4F' },
  { name: 'Rose Petal', hex: '#C2185B' },
  { name: 'Nude Silk', hex: '#C98A7A' },
] as const;

/** A lipstick with three shades (the third sold out), a video and a procedural 3D model. */
export function lipstick(over: Partial<Product> = {}): Product {
  return {
    id: 'prd-1',
    slug: 'velvet-matte-lipstick',
    title: 'Velvet Matte Lipstick',
    brand: { id: 'br-glow', slug: 'glow', name: 'Glow' },
    seller: {
      id: 'sel-glow',
      slug: 'glow-cosmetics',
      storeName: 'Glow Cosmetics',
      type: 'manufacturer',
      badge: 'official_brand',
    },
    categoryId: 'cat-lips',
    images: [
      {
        url: '/placeholders/lipstick-1.svg',
        alt: 'Velvet Matte Lipstick',
        width: 800,
        height: 1000,
      },
      {
        url: '/placeholders/lipstick-2.svg',
        alt: 'Velvet Matte Lipstick, open',
        width: 800,
        height: 1000,
      },
    ],
    price: 185000,
    compareAtPrice: 220000,
    currency: 'PKR',
    shades: SHADES.map((s) => ({ ...s })),
    rating: 4.8,
    ratingCount: 214,
    has3d: true,
    hasVideo: true,
    isNew: false,
    sponsored: false,
    quickAddVariantId: null,
    descriptionHtml: '<p>Soft matte colour.</p>',
    howToUse: 'Apply from the centre outwards.',
    ingredients: 'Ricinus communis seed oil, cera alba.',
    skinTypes: [],
    tags: ['lipstick'],
    variants: SHADES.map((s, i) =>
      variant(i + 1, { shadeName: s.name, shadeHex: s.hex, stock: i === 2 ? 0 : 25 }),
    ),
    media: [
      image(1, 'Velvet Matte Lipstick'),
      image(2, 'Velvet Matte Lipstick, open'),
      {
        id: 'video-1',
        type: 'video',
        url: '/placeholders/video-placeholder.webm',
        posterUrl: '/placeholders/lipstick-2.svg',
        alt: 'Velvet Matte Lipstick video',
        model3dKind: null,
      },
      {
        id: '3d-1',
        type: 'model3d',
        url: '',
        posterUrl: null,
        alt: '3D view of Velvet Matte Lipstick',
        model3dKind: 'lipstick',
      },
    ],
    soldCount: 600,
    ...over,
  };
}

/** One variant, no shades, images only. */
export function lipOil(over: Partial<Product> = {}): Product {
  return lipstick({
    id: 'prd-3',
    slug: 'silk-lip-oil',
    title: 'Silk Lip Oil',
    shades: [],
    has3d: false,
    hasVideo: false,
    compareAtPrice: null,
    price: 120000,
    quickAddVariantId: 'silk-lip-oil-v1',
    variants: [
      variant(1, { id: 'silk-lip-oil-v1', sku: 'SILK-1', price: 120000, compareAtPrice: null }),
    ],
    media: [image(1, 'Silk Lip Oil')],
    ...over,
  });
}

/** Two sizes of the same perfume. */
export function perfume(over: Partial<Product> = {}): Product {
  return lipstick({
    id: 'prd-12',
    slug: 'damask-rose-eau-de-parfum',
    title: 'Damask Rose Eau de Parfum',
    shades: [],
    variants: [
      variant(1, { id: 'damask-50', sizeLabel: '50 ml', price: 850000, compareAtPrice: null }),
      variant(2, { id: 'damask-100', sizeLabel: '100 ml', price: 1400000, compareAtPrice: null }),
    ],
    ...over,
  });
}

export function review(n: number, over: Partial<Review> = {}): Review {
  return {
    id: `rev-${n}`,
    productId: 'prd-1',
    authorName: `Shopper ${n}`,
    rating: 5,
    title: `Review ${n}`,
    body: 'Lovely colour.',
    photos: [],
    verifiedPurchase: true,
    createdAt: `2026-09-${String(10 + n).padStart(2, '0')}T10:00:00.000Z`,
    ...over,
  };
}

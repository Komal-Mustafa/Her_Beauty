import type {
  AdPackage,
  Brand,
  Category,
  DeliveryZone,
  HeroScene,
  Product,
  ProductMedia,
  Review,
  SellingPlan,
  ServedAd,
  ShippingProfile,
  ShippingRateBand,
  SkinType,
  Store,
  Variant,
} from '@hb/types';
import { rupees } from '../format';

/*
 * Mock catalogue for UI development, also loaded into the database by packages/db/prisma/seed.ts
 * so mock mode and http mode show the same shop (docs/p5-catalog.md §6). Brand and store names
 * are invented. Numbers for plans and ad packages come from docs/01-prd.md §7.5–7.6 and are
 * still [CONFIRM] with the client. Images are local SVG placeholders under each app's
 * /public/placeholders.
 */

type Kind =
  | 'lipstick'
  | 'compact'
  | 'perfume'
  | 'jar'
  | 'serum'
  | 'palette'
  | 'brush'
  | 'tube'
  | 'mascara'
  | 'bottle';

const img = (kind: Kind, alt: string, variant = 1) => ({
  url: `/placeholders/${kind}-${variant}.svg`,
  alt,
  width: 800,
  height: 1000,
});

const logo = (name: string) => ({
  url: '/placeholders/brand-mark.svg',
  alt: `${name} logo`,
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
    image: img('bottle', 'Hair oils'),
    parentId: null,
  },
  {
    id: 'cat-tools',
    slug: 'tools',
    name: 'Tools',
    image: img('brush', 'Brushes and tools'),
    parentId: null,
  },
];

/** Stores before their rating and product count, which are computed from the products below. */
const storeSeeds: Omit<Store, 'rating' | 'productCount'>[] = [
  {
    id: 'sel-glow',
    slug: 'glow-cosmetics',
    storeName: 'Glow Cosmetics',
    type: 'manufacturer',
    badge: 'official_brand',
    logo: logo('Glow Cosmetics'),
    city: 'Lahore',
    banner: img('lipstick', 'Glow Cosmetics banner', 2),
    about: 'Lahore-made lipsticks and blush, cruelty-free since 2019.',
    joinedAt: '2026-01-12T00:00:00.000Z',
  },
  {
    id: 'sel-beautypoint',
    slug: 'beauty-point',
    storeName: 'Beauty Point',
    type: 'vendor',
    badge: 'verified_seller',
    logo: logo('Beauty Point'),
    city: 'Karachi',
    banner: img('palette', 'Beauty Point banner'),
    about: 'Authorised stockist of 20 international and local brands.',
    joinedAt: '2026-02-03T00:00:00.000Z',
  },
  {
    id: 'sel-rosehouse',
    slug: 'rose-house',
    storeName: 'Rose House',
    type: 'manufacturer',
    badge: 'official_brand',
    logo: logo('Rose House'),
    city: 'Islamabad',
    banner: img('perfume', 'Rose House banner'),
    about: 'Fine fragrances distilled from Pakistani damask roses.',
    joinedAt: '2026-03-18T00:00:00.000Z',
  },
  {
    id: 'sel-skinlab',
    slug: 'skin-lab',
    storeName: 'Skin Lab PK',
    type: 'vendor',
    badge: 'verified_seller',
    logo: logo('Skin Lab PK'),
    city: 'Lahore',
    banner: img('serum', 'Skin Lab banner'),
    about: 'Dermatologist-picked skincare, shipped in 48 hours.',
    joinedAt: '2026-04-09T00:00:00.000Z',
  },
  {
    id: 'sel-velvet',
    slug: 'velvet-studio',
    storeName: 'Velvet Studio',
    type: 'manufacturer',
    badge: 'official_brand',
    logo: logo('Velvet Studio'),
    city: 'Faisalabad',
    banner: img('compact', 'Velvet Studio banner', 2),
    about: 'Soft-matte face products for South Asian skin tones.',
    joinedAt: '2026-05-21T00:00:00.000Z',
  },
  {
    id: 'sel-gulposh',
    slug: 'gulposh-beauty',
    storeName: 'Gulposh Beauty',
    type: 'vendor',
    badge: 'verified_seller',
    logo: logo('Gulposh Beauty'),
    city: 'Peshawar',
    banner: img('bottle', 'Gulposh Beauty banner', 2),
    about: 'Hair and body care from Peshawar, with herbal oils our customers grew up with.',
    joinedAt: '2026-06-02T00:00:00.000Z',
  },
  {
    id: 'sel-chandni',
    slug: 'chandni-glam',
    storeName: 'Chandni Glam',
    type: 'vendor',
    badge: 'verified_seller',
    logo: logo('Chandni Glam'),
    city: 'Rawalpindi',
    banner: img('mascara', 'Chandni Glam banner', 2),
    about: 'Eye and lip makeup, brushes and bridal essentials for the twin cities and beyond.',
    joinedAt: '2026-06-24T00:00:00.000Z',
  },
  {
    id: 'sel-sahil',
    slug: 'sahil-beauty',
    storeName: 'Sahil Beauty Hub',
    type: 'vendor',
    badge: 'verified_seller',
    logo: logo('Sahil Beauty Hub'),
    city: 'Karachi',
    banner: img('tube', 'Sahil Beauty Hub banner', 2),
    about: 'Sun care, attars and body care picked for Karachi weather.',
    joinedAt: '2026-07-15T00:00:00.000Z',
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
  {
    // Trademark verified, but the maker does not sell on HB itself: resellers stock it.
    id: 'br-surmai',
    slug: 'surmai',
    name: 'Surmai',
    logo: logo('Surmai'),
    isProtected: true,
    ownerSellerId: null,
  },
  {
    id: 'br-amla',
    slug: 'amla-grove',
    name: 'Amla Grove',
    logo: logo('Amla Grove'),
    isProtected: false,
    ownerSellerId: null,
  },
  {
    id: 'br-qalam',
    slug: 'qalam',
    name: 'Qalam',
    logo: logo('Qalam'),
    isProtected: false,
    ownerSellerId: null,
  },
  {
    id: 'br-chambeli',
    slug: 'chambeli',
    name: 'Chambeli',
    logo: logo('Chambeli'),
    isProtected: false,
    ownerSellerId: null,
  },
  {
    id: 'br-sheen',
    slug: 'sheen-lab',
    name: 'Sheen Lab',
    logo: logo('Sheen Lab'),
    isProtected: false,
    ownerSellerId: null,
  },
  {
    id: 'br-mehr',
    slug: 'mehr',
    name: 'Mehr',
    logo: logo('Mehr'),
    isProtected: false,
    ownerSellerId: null,
  },
];

// ---------- shades (each is pinned to its family in shade-families.test.ts) ----------

type Shade = { name: string; hex: string };
const shade = (name: string, hex: string): Shade => ({ name, hex });

/** Every shade in the catalogue, by name. */
export const SHADES = {
  berryKiss: shade('Berry Kiss', '#8E1B4F'),
  rosePetal: shade('Rose Petal', '#C2185B'),
  nudeSilk: shade('Nude Silk', '#C98A7A'),
  coralBloom: shade('Coral Bloom', '#E5675C'),
  classicRed: shade('Classic Red', '#B3122E'),
  cocoa: shade('Cocoa', '#7B4A3A'),
  candy: shade('Candy', '#E75A9B'),
  plum: shade('Plum', '#6B1F3F'),
  softTaupe: shade('Soft Taupe', '#B89A8A'),
  toffee: shade('Toffee', '#9C6B4E'),
  rosewood: shade('Rosewood', '#9E6B78'),
  crimson: shade('Crimson', '#A4161A'),
  blackCherry: shade('Black Cherry', '#5C1A33'),
  biscuit: shade('Biscuit', '#D1A38A'),
  caramelNude: shade('Caramel Nude', '#B7806A'),
  bubblegum: shade('Bubblegum', '#F48FB1'),
  chilli: shade('Chilli', '#9E1B1B'),
  papaya: shade('Papaya', '#F07A5A'),
  dustyMauve: shade('Dusty Mauve', '#A86F83'),
  espresso: shade('Espresso', '#4A2C24'),
  peony: shade('Peony', '#F4A6C0'),
  peach: shade('Peach', '#F29C80'),
  sheerNude: shade('Sheer Nude', '#D9A08E'),
  berryFlush: shade('Berry Flush', '#7E2250'),
  apricot: shade('Apricot', '#F2A07B'),
  mauve: shade('Mauve', '#B8738C'),
  sunsetCoral: shade('Sunset Coral', '#E4704F'),
  cinnamon: shade('Cinnamon', '#A0634A'),
  porcelain: shade('Porcelain', '#F4DDCB'),
  ivory: shade('Ivory', '#F1D3BC'),
  sand: shade('Sand', '#D9B596'),
  honey: shade('Honey', '#C68E5E'),
  caramel: shade('Caramel', '#B97A56'),
  mocha: shade('Mocha', '#8D5A3B'),
  gold: shade('Gold', '#D4AF37'),
  champagne: shade('Champagne', '#E8C98F'),
  roseGold: shade('Rose Gold', '#E6BE8A'),
  chestnut: shade('Chestnut', '#8B4A2B'),
} as const;

const S = SHADES;

// ---------- ingredient lists (INCI) shared by similar formulas ----------

const INCI = {
  matteLipstick:
    'Isododecane, Dimethicone, Trimethylsiloxysilicate, Polyethylene, Kaolin, Synthetic Wax, Tocopheryl Acetate, Parfum, [+/- CI 77491, CI 15850, CI 45410, CI 77891]',
  satinLipstick:
    'Ricinus Communis (Castor) Seed Oil, Octyldodecanol, Euphorbia Cerifera (Candelilla) Wax, Cera Alba, Butyrospermum Parkii (Shea) Butter, Tocopheryl Acetate, Parfum, [+/- CI 15850, CI 45410, CI 77491, CI 77891]',
  pressedPowder:
    'Talc, Mica, Zinc Stearate, Dimethicone, Octyldodecyl Stearoyl Stearate, Caprylyl Glycol, Phenoxyethanol, [+/- CI 77491, CI 77492, CI 77499, CI 77891, CI 15850]',
  eyeshadow:
    'Talc, Mica, Magnesium Stearate, Dimethicone, Ethylhexyl Palmitate, Silica, Phenoxyethanol, [+/- CI 77491, CI 77492, CI 77499, CI 77891, CI 77742]',
  perfume: 'Alcohol Denat., Parfum, Aqua, Linalool, Citronellol, Geraniol, Limonene, Eugenol',
  conditioner:
    'Aqua, Cetearyl Alcohol, Behentrimonium Chloride, Butyrospermum Parkii (Shea) Butter, Panthenol, Dimethicone, Parfum, Phenoxyethanol',
} as const;

type Size = { label: string; price: number; compareAt?: number };

type ReviewSeed = {
  /** Index into REVIEW_AUTHORS; one review per shopper per product. */
  by: number;
  rating: 3 | 4 | 5;
  title: string;
  body: string;
  /** A customer photo (the product's second placeholder view). */
  photo?: boolean;
};

type Seed = {
  slug: string;
  title: string;
  kind: Kind;
  brandId: string;
  sellerId: string;
  categoryId: string;
  /** Whole rupees; with `sizes`, the sizes carry the prices. */
  price: number;
  compareAt?: number;
  shades?: readonly Shade[];
  /** Size variants (instead of shades), cheapest first. */
  sizes?: readonly Size[];
  /** Size label of every variant when the product has no size variants. */
  size?: string;
  /** Variant indexes that are sold out. */
  soldOut?: readonly number[];
  outOfStock?: boolean;
  has3d?: boolean;
  hasVideo?: boolean;
  isNew?: boolean;
  rating: number;
  ratingCount: number;
  skin?: SkinType[];
  /** Search words besides the title, brand, store, category and shade names. */
  tags: string[];
  /** The description paragraph, then three benefits (plain text). */
  about: string;
  benefits: [string, string, string];
  howToUse: string;
  /** INCI list, or materials for tools. */
  ingredients: string;
  reviews?: ReviewSeed[];
};

const ALL_SKIN: SkinType[] = ['dry', 'oily', 'combination', 'normal', 'sensitive'];

/*
 * 48 products, 6 per category. The first 16 keep their slugs and ids (prd-1…prd-16): ads, the
 * hero and tests refer to them. About a third are on sale, a quarter new, two are out of stock.
 */
const seeds: Seed[] = [
  // ---------- 1–16: the original catalogue ----------
  {
    slug: 'velvet-matte-lipstick',
    title: 'Velvet Matte Lipstick',
    kind: 'lipstick',
    brandId: 'br-glow',
    sellerId: 'sel-glow',
    categoryId: 'cat-lips',
    price: 1850,
    compareAt: 2200,
    shades: [S.berryKiss, S.rosePetal, S.nudeSilk, S.coralBloom, S.classicRed, S.cocoa],
    size: '3.5 g',
    soldOut: [2],
    has3d: true,
    hasVideo: true,
    rating: 4.8,
    ratingCount: 214,
    tags: ['lipstick', 'matte', 'long-wear', 'transfer-resistant', 'vegan'],
    about:
      'A weightless matte lipstick with a creamy glide and full colour in one swipe. The comfort-matte formula is enriched with vitamin E so lips never feel tight.',
    benefits: [
      'Stays put for up to 10 hours',
      'Does not dry or crack on the lips',
      'Cruelty-free and made in Lahore',
    ],
    howToUse:
      'Start at the centre of the upper lip and follow the contour outwards, then fill in the lower lip. Blot with a tissue and apply a second coat for maximum intensity.',
    ingredients: INCI.matteLipstick,
    reviews: [
      {
        by: 0,
        rating: 5,
        title: 'Berry Kiss is my signature now',
        body: 'Stays put through chai and dinner, and it does not dry my lips like other mattes.',
      },
      {
        by: 2,
        rating: 5,
        title: 'Lasts through a long day',
        body: 'Wore it from a morning class to a family dinner and it still looked fresh.',
        photo: true,
      },
      {
        by: 4,
        rating: 4,
        title: 'Worth every rupee',
        body: 'Rich colour in one swipe. One star less because Nude Silk sold out before I could order it.',
      },
    ],
  },
  {
    slug: 'satin-glow-lipstick',
    title: 'Satin Glow Lipstick',
    kind: 'lipstick',
    brandId: 'br-glow',
    sellerId: 'sel-glow',
    categoryId: 'cat-lips',
    price: 1650,
    shades: [S.rosePetal, S.nudeSilk, S.coralBloom, S.candy, S.plum],
    size: '3.5 g',
    soldOut: [2],
    has3d: true,
    isNew: true,
    rating: 4.7,
    ratingCount: 88,
    tags: ['lipstick', 'satin', 'hydrating', 'shea butter'],
    about:
      'A satin-finish lipstick that feels like a balm and looks like silk. Shea butter and castor oil cushion the lips while the colour builds from a sheer wash to a rich finish.',
    benefits: [
      'Soft satin shine without stickiness',
      'Moisturises with shea butter',
      'Buildable from sheer to full colour',
    ],
    howToUse:
      'Glide directly onto clean lips. For a softer look, dab on with a fingertip and press the lips together.',
    ingredients: INCI.satinLipstick,
    reviews: [
      {
        by: 1,
        rating: 5,
        title: 'Glossy without being sticky',
        body: 'Rose Petal has a lovely satin shine and feels like a balm. Arrived sealed in three days.',
      },
      {
        by: 3,
        rating: 4,
        title: 'Pretty everyday colour',
        body: 'Needs a touch-up after lunch, but the finish is so soft that I do not mind.',
      },
    ],
  },
  {
    slug: 'silk-lip-oil',
    title: 'Silk Lip Oil',
    kind: 'serum',
    brandId: 'br-dewy',
    sellerId: 'sel-beautypoint',
    categoryId: 'cat-lips',
    price: 1200,
    size: '6 ml',
    rating: 4.4,
    ratingCount: 51,
    isNew: true,
    tags: ['lip oil', 'gloss', 'hydrating', 'rosehip'],
    about:
      'A non-sticky lip oil that leaves a glassy shine and nourishes overnight. Squalane and rosehip oil soften dry lips while a hint of vanilla makes it a treat to wear.',
    benefits: [
      'Mirror shine over lipstick or alone',
      'Softens dry, flaky lips',
      'Non-sticky, lightweight feel',
    ],
    howToUse:
      'Sweep the doe-foot applicator over bare lips or on top of lipstick. Reapply as often as you like; use a generous layer before bed.',
    ingredients:
      'Squalane, Prunus Amygdalus Dulcis (Sweet Almond) Oil, Rosa Canina Fruit Oil, Hydrogenated Polyisobutene, Tocopherol, Aroma, CI 15985',
    reviews: [
      {
        by: 2,
        rating: 5,
        title: 'My lips have never been this soft',
        body: 'I put it on before bed and wake up with smooth lips. Smells lightly of vanilla.',
      },
      {
        by: 0,
        rating: 4,
        title: 'Nice shine, light feel',
        body: 'Gives a glassy look over lipstick. The bottle is small, so it is a bit pricey for the size.',
      },
    ],
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
    shades: [S.peony, S.apricot, S.mauve, S.berryFlush, S.sunsetCoral],
    size: '6 g',
    soldOut: [2],
    has3d: true,
    hasVideo: true,
    rating: 4.9,
    ratingCount: 167,
    skin: ['normal', 'dry', 'combination', 'oily'],
    tags: ['blush', 'powder blush', 'buildable', 'natural flush'],
    about:
      'A silky powder blush in a gold compact with a full-size mirror. Finely milled pigments blend into a natural flush that suits warm and olive South Asian skin tones.',
    benefits: [
      'Blends without patches',
      'Buildable from a soft flush to vivid colour',
      'Gold compact with a large mirror',
    ],
    howToUse:
      'Smile and sweep a fluffy brush over the apples of the cheeks, blending up towards the temples. Tap off excess powder before applying.',
    ingredients: INCI.pressedPowder,
    reviews: [
      {
        by: 3,
        rating: 5,
        title: 'The most natural flush',
        body: 'Peony looks like my own cheeks on a good day. A little goes a long way.',
      },
      {
        by: 1,
        rating: 5,
        title: 'Beautiful compact',
        body: 'The gold case feels premium and the mirror is big enough to use on the go.',
        photo: true,
      },
      {
        by: 4,
        rating: 4,
        title: 'Buildable and soft',
        body: 'Blends easily on my warm skin tone. Apricot is gorgeous for summer.',
      },
    ],
  },
  {
    slug: 'soft-focus-powder',
    title: 'Soft Focus Pressed Powder',
    kind: 'compact',
    brandId: 'br-velvet',
    sellerId: 'sel-velvet',
    categoryId: 'cat-face',
    price: 2100,
    shades: [S.porcelain, S.sand, S.honey, S.mocha],
    size: '9 g',
    has3d: true,
    rating: 4.6,
    ratingCount: 73,
    skin: ['oily', 'combination'],
    tags: ['powder', 'setting powder', 'oil control', 'matte', 'blurring'],
    about:
      'A blurring pressed powder that sets makeup and controls shine without a white cast. Soft-focus pigments smooth the look of pores in daylight and in photos.',
    benefits: [
      'Controls shine for up to 8 hours',
      'No flashback in photos',
      'Four shades for fair to deep skin',
    ],
    howToUse:
      'Press lightly onto the T-zone with the puff or a powder brush after foundation. Touch up during the day as needed.',
    ingredients:
      'Talc, Mica, Silica, Magnesium Stearate, Dimethicone, Caprylic/Capric Triglyceride, Phenoxyethanol, Ethylhexylglycerin, [+/- CI 77891, CI 77491, CI 77492, CI 77499]',
    reviews: [
      {
        by: 4,
        rating: 5,
        title: 'Keeps shine away',
        body: 'My T-zone stays matte until evening even in Lahore heat. No white cast in photos.',
      },
      {
        by: 0,
        rating: 3,
        title: 'Good, but I need an in-between shade',
        body: 'Works well on oily skin. I wish there was a shade between Honey and Mocha.',
      },
    ],
  },
  {
    slug: 'lumiere-highlighter',
    title: 'Lumière Gold Highlighter',
    kind: 'compact',
    brandId: 'br-lumiere',
    sellerId: 'sel-beautypoint',
    categoryId: 'cat-face',
    price: 2750,
    shades: [S.gold, S.champagne, S.roseGold],
    size: '8 g',
    rating: 4.5,
    ratingCount: 40,
    isNew: true,
    tags: ['highlighter', 'shimmer', 'glow', 'strobing'],
    about:
      'A molten-gold pressed highlighter that catches the light without visible glitter. Ultra-fine pearls melt into the skin for a lit-from-within glow.',
    benefits: [
      'Smooth, glitter-free glow',
      'Builds from subtle to blinding',
      'Works on the cheekbones, nose and brow bone',
    ],
    howToUse:
      'Tap a fan or small tapered brush into the pan and sweep onto the high points of the face. Layer for a stronger glow.',
    ingredients:
      'Mica, Synthetic Fluorphlogopite, Talc, Calcium Aluminum Borosilicate, Dimethicone, Tin Oxide, Phenoxyethanol, [+/- CI 77891, CI 77491, CI 77492]',
    reviews: [
      {
        by: 0,
        rating: 5,
        title: 'Gold glow for shaadi season',
        body: 'One dab on the cheekbones catches the light beautifully, and it is not glittery.',
      },
      {
        by: 3,
        rating: 4,
        title: 'Champagne is stunning',
        body: 'Very pigmented, so use a light hand. Packaging arrived perfectly wrapped.',
      },
    ],
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
    size: '12 × 1.5 g',
    hasVideo: true,
    rating: 4.7,
    ratingCount: 129,
    tags: ['eyeshadow', 'palette', 'shimmer', 'matte', 'rose gold'],
    about:
      'Twelve rose, mauve and bronze shades in mattes and buttery shimmers, curated for day-to-night looks. Blendable, richly pigmented and made for South Asian skin tones.',
    benefits: [
      'Twelve shades from everyday to bridal',
      'Buttery shimmers with little fallout',
      'Large mirror inside the lid',
    ],
    howToUse:
      'Apply a light matte across the lid, deepen the crease with a darker shade, then press a shimmer onto the centre of the lid with a fingertip.',
    ingredients: INCI.eyeshadow,
    reviews: [
      {
        by: 1,
        rating: 5,
        title: 'Every shade is wearable',
        body: 'Matte and shimmer shades that work for office and weddings. Very little fallout.',
        photo: true,
      },
      {
        by: 2,
        rating: 4,
        title: 'Lovely pinks and browns',
        body: 'The shimmers are buttery. The mattes need a primer to show their true colour.',
      },
      {
        by: 4,
        rating: 5,
        title: 'Genuine product, fast delivery',
        body: 'Arrived in two days with the seal intact. Knowing my payment was protected made ordering easy.',
      },
    ],
  },
  {
    slug: 'gilded-eyes-palette',
    title: 'Gilded Eyes Palette',
    kind: 'palette',
    brandId: 'br-saffron',
    sellerId: 'sel-beautypoint',
    categoryId: 'cat-eyes',
    price: 3400,
    size: '9 × 1.8 g',
    rating: 4.3,
    ratingCount: 36,
    tags: ['eyeshadow', 'palette', 'metallic', 'gold', 'bridal'],
    about:
      'Nine metallic golds, bronzes and warm browns for festive and bridal eyes. The foiled finish goes on smoothly with a brush or a damp fingertip.',
    benefits: [
      'Foil-like metallic finish',
      'Warm golds for festive looks',
      'Long-wearing over a primer',
    ],
    howToUse:
      'For the most metallic finish, dampen a flat brush, pick up the shade and press it onto the lid. Blend the edges with a matte brown.',
    ingredients: INCI.eyeshadow,
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
    size: '30 ml',
    hasVideo: true,
    rating: 4.8,
    ratingCount: 302,
    skin: ['normal', 'dry', 'combination'],
    tags: ['vitamin c', 'serum', 'brightening', 'dark spots', 'antioxidant'],
    about:
      'A brightening serum with stabilised vitamin C, ferulic acid and vitamin E. It fades dark spots, evens the skin tone and defends against daily pollution.',
    benefits: [
      'Fades dark spots and uneven tone',
      'Antioxidant protection with ferulic acid',
      'Light texture that sits well under sunscreen',
    ],
    howToUse:
      'Every morning, apply 3–4 drops to clean, dry skin and press in. Follow with moisturiser and sunscreen. Keep the cap tightly closed.',
    ingredients:
      'Aqua, Ascorbic Acid, Propanediol, Glycerin, Ferulic Acid, Tocopherol, Sodium Hyaluronate, Panthenol, Phenoxyethanol',
    reviews: [
      {
        by: 2,
        rating: 5,
        title: 'Brighter skin in three weeks',
        body: 'My dark spots have faded and my skin looks awake. No stinging at all.',
      },
      {
        by: 0,
        rating: 5,
        title: 'The glow is real',
        body: 'I layer it under sunscreen every morning. The dark bottle keeps it fresh.',
      },
      {
        by: 3,
        rating: 4,
        title: 'Works, but give it time',
        body: 'Took about a month to see a difference. The texture is light and absorbs quickly.',
      },
      {
        by: 1,
        rating: 3,
        title: 'Good serum, slight tingle',
        body: 'Good results, but it tingles on my sensitive cheeks, so I use it every other day.',
      },
    ],
  },
  {
    slug: 'hyaluronic-dew-serum',
    title: 'Hyaluronic Dew Serum',
    kind: 'serum',
    brandId: 'br-dewy',
    sellerId: 'sel-skinlab',
    categoryId: 'cat-skincare',
    price: 2650,
    size: '30 ml',
    rating: 4.6,
    ratingCount: 190,
    isNew: true,
    skin: ['dry', 'sensitive'],
    tags: ['hyaluronic acid', 'serum', 'hydrating', 'fragrance-free'],
    about:
      'A fragrance-free hydrating serum with two weights of hyaluronic acid. It plumps dry skin at once and keeps it comfortable all day.',
    benefits: [
      'Instant plumping hydration',
      'Fragrance-free, for sensitive skin',
      'Makes makeup sit smoothly',
    ],
    howToUse: 'Apply a few drops to damp skin morning and night, then seal in with moisturiser.',
    ingredients:
      'Aqua, Sodium Hyaluronate, Hydrolyzed Hyaluronic Acid, Glycerin, Panthenol, Allantoin, Pentylene Glycol, Phenoxyethanol',
    reviews: [
      {
        by: 4,
        rating: 5,
        title: 'Instant plump',
        body: 'My dry skin drinks it up. Makeup sits much better on top.',
      },
      {
        by: 1,
        rating: 4,
        title: 'Hydrating and gentle',
        body: 'No fragrance and no irritation. I just wish the bottle were bigger.',
      },
    ],
  },
  {
    slug: 'rose-water-cream',
    title: 'Rose Water Night Cream',
    kind: 'jar',
    brandId: 'br-rose',
    sellerId: 'sel-rosehouse',
    categoryId: 'cat-skincare',
    price: 3200,
    size: '50 g',
    has3d: true,
    rating: 4.9,
    ratingCount: 98,
    skin: ['dry', 'normal'],
    tags: ['night cream', 'moisturiser', 'rose water', 'ceramides'],
    about:
      'A rich night cream made with our own damask rose water, shea butter and ceramides. It restores the skin barrier while you sleep.',
    benefits: [
      'Deep overnight moisture',
      'Ceramides support the skin barrier',
      'Distilled rose water from our own farms',
    ],
    howToUse:
      'Warm a pea-sized amount between the fingertips and press onto the face and neck as the last step of your evening routine.',
    ingredients:
      'Aqua, Rosa Damascena Flower Water, Butyrospermum Parkii (Shea) Butter, Cetearyl Alcohol, Glycerin, Squalane, Ceramide NP, Rosa Damascena Flower Oil, Tocopherol, Phenoxyethanol',
    reviews: [
      {
        by: 3,
        rating: 5,
        title: 'Smells like a rose garden',
        body: 'Rich but not greasy. I wake up with soft, calm skin.',
      },
      {
        by: 4,
        rating: 5,
        title: 'My new favourite',
        body: 'Gentle on my skin and it suits my routine. The seller packed it with real care.',
      },
      {
        by: 2,
        rating: 4,
        title: 'Lovely for winter',
        body: 'Perfect for dry weather; in summer I use just a small amount.',
      },
    ],
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
    size: '50 ml',
    has3d: true,
    hasVideo: true,
    rating: 4.9,
    ratingCount: 76,
    tags: ['perfume', 'eau de parfum', 'rose', 'floral', 'long-lasting'],
    about:
      'A luminous rose fragrance built around Pakistani damask rose absolute, softened with pink pepper, sandalwood and a whisper of musk.',
    benefits: [
      'Long-lasting floral trail',
      'Real damask rose absolute',
      'Hand-finished glass bottle',
    ],
    howToUse:
      'Spray on the pulse points from about 15 cm away. Do not rub the wrists together; let the fragrance settle on its own.',
    ingredients: INCI.perfume,
    reviews: [
      {
        by: 1,
        rating: 5,
        title: 'Compliments every time',
        body: 'A true Pakistani rose, soft and warm. It lasts on my clothes until the next day.',
      },
      {
        by: 3,
        rating: 5,
        title: 'An elegant gift',
        body: 'Bought it for my mother and she loves it. The bottle looks beautiful on a dresser.',
        photo: true,
      },
      {
        by: 0,
        rating: 4,
        title: 'Beautiful but strong',
        body: 'Two sprays are enough. The dry-down is my favourite part.',
      },
    ],
  },
  {
    slug: 'oud-blush-parfum',
    title: 'Oud Blush Parfum',
    kind: 'perfume',
    brandId: 'br-rose',
    sellerId: 'sel-rosehouse',
    categoryId: 'cat-fragrance',
    price: 9900,
    size: '50 ml',
    has3d: true,
    isNew: true,
    rating: 4.8,
    ratingCount: 22,
    tags: ['perfume', 'parfum', 'oud', 'rose', 'oriental'],
    about:
      'Smoky oud meets blushing rose and saffron in a rich, evening parfum concentration. Warm, soft and made to linger.',
    benefits: [
      'Parfum concentration for all-evening wear',
      'Oud, rose and saffron accord',
      'Signature Rose House bottle',
    ],
    howToUse:
      'Apply one or two sprays to the neck and behind the ears. A little on the hair brush leaves a soft trail.',
    ingredients: INCI.perfume,
  },
  {
    slug: 'saffron-body-butter',
    title: 'Saffron Body Butter',
    kind: 'jar',
    brandId: 'br-saffron',
    sellerId: 'sel-beautypoint',
    categoryId: 'cat-body',
    price: 1950,
    size: '200 g',
    rating: 4.4,
    ratingCount: 64,
    skin: ['dry', 'normal'],
    tags: ['body butter', 'moisturiser', 'shea butter', 'saffron'],
    about:
      'A whipped body butter with shea, cocoa butter and a touch of saffron. It melts in to soften dry elbows, knees and heels.',
    benefits: [
      'Rich 24-hour moisture',
      'Softens rough elbows and heels',
      'Warm, subtle saffron scent',
    ],
    howToUse:
      'Massage into skin after a bath, focusing on dry areas. Use daily in winter and as needed in summer.',
    ingredients:
      'Butyrospermum Parkii (Shea) Butter, Cocos Nucifera (Coconut) Oil, Theobroma Cacao (Cocoa) Seed Butter, Crocus Sativus (Saffron) Flower Extract, Tocopherol, Parfum',
    reviews: [
      {
        by: 0,
        rating: 5,
        title: 'Rich and nourishing',
        body: 'Melts into skin and keeps my elbows soft all day. The saffron scent is subtle.',
      },
      {
        by: 4,
        rating: 3,
        title: 'Nice but heavy for summer',
        body: 'Great moisture, but it takes a while to sink in on humid days.',
      },
    ],
  },
  {
    slug: 'argan-hair-elixir',
    title: 'Argan Hair Elixir',
    kind: 'bottle',
    brandId: 'br-saffron',
    sellerId: 'sel-skinlab',
    categoryId: 'cat-hair',
    price: 1750,
    size: '50 ml',
    rating: 4.5,
    ratingCount: 112,
    tags: ['hair oil', 'hair serum', 'argan oil', 'frizz control', 'shine'],
    about:
      'A silky argan oil elixir that tames frizz and adds mirror shine without weighing hair down. Heat protection up to 200 °C.',
    benefits: [
      'Tames frizz in humid weather',
      'Glossy, non-greasy finish',
      'Protects from heat styling',
    ],
    howToUse:
      'Rub one or two pumps between the palms and smooth over damp or dry lengths, avoiding the roots.',
    ingredients:
      'Cyclopentasiloxane, Dimethiconol, Argania Spinosa (Argan) Kernel Oil, Tocopheryl Acetate, Parfum',
    reviews: [
      {
        by: 3,
        rating: 5,
        title: 'Frizz gone',
        body: 'Two drops tame my frizz and my hair looks glossy without being oily.',
      },
      {
        by: 2,
        rating: 4,
        title: 'Smooth ends',
        body: 'My split ends look much better. The pump makes it easy not to overuse.',
      },
    ],
  },
  {
    slug: 'gold-kabuki-brush',
    title: 'Gold Kabuki Brush',
    kind: 'brush',
    brandId: 'br-lumiere',
    sellerId: 'sel-beautypoint',
    categoryId: 'cat-tools',
    price: 1450,
    rating: 4.6,
    ratingCount: 58,
    tags: ['brush', 'kabuki', 'foundation brush', 'powder brush', 'vegan'],
    about:
      'A dense, ultra-soft kabuki brush for buffing foundation and powder to an airbrushed finish. Cruelty-free synthetic bristles in a gold ferrule.',
    benefits: ['Airbrushed finish', 'Does not shed', 'Vegan synthetic bristles'],
    howToUse:
      'Buff liquid or powder products onto the skin in small circles. Wash weekly with mild shampoo and dry flat.',
    ingredients: 'Synthetic taklon bristles, gold-tone aluminium ferrule, birch wood handle',
    reviews: [
      {
        by: 4,
        rating: 5,
        title: 'So soft',
        body: 'Buffs powder and foundation smoothly and does not shed. Washes well too.',
      },
      {
        by: 1,
        rating: 4,
        title: 'Good value',
        body: 'Dense and soft. The gold handle looks lovely on my vanity.',
      },
    ],
  },
  // ---------- 17–48 ----------
  {
    slug: 'mehr-lip-liner',
    title: 'Precision Lip Liner',
    kind: 'lipstick',
    brandId: 'br-mehr',
    sellerId: 'sel-chandni',
    categoryId: 'cat-lips',
    price: 850,
    compareAt: 990,
    shades: [S.softTaupe, S.toffee, S.rosewood, S.crimson, S.blackCherry],
    size: '1.2 g',
    rating: 4.3,
    ratingCount: 47,
    tags: ['lip liner', 'pencil', 'long-wear', 'waterproof'],
    about:
      'A creamy, waterproof lip pencil that defines and stops lipstick from feathering. Five shades that pair with every lipstick in the Mehr range.',
    benefits: [
      'Stops lipstick feathering',
      'Waterproof and long-wearing',
      'Built-in sharpener cap',
    ],
    howToUse:
      'Outline the lips starting at the cupid’s bow, then fill in lightly to help lipstick last longer.',
    ingredients:
      'Hydrogenated Vegetable Oil, Octyldodecyl Stearoyl Stearate, Euphorbia Cerifera (Candelilla) Wax, Mica, Tocopheryl Acetate, [+/- CI 77491, CI 77492, CI 77499, CI 15850]',
  },
  {
    slug: 'mehr-liquid-lipstick',
    title: 'Liquid Matte Lipstick',
    kind: 'lipstick',
    brandId: 'br-mehr',
    sellerId: 'sel-chandni',
    categoryId: 'cat-lips',
    price: 1450,
    shades: [
      S.biscuit,
      S.caramelNude,
      S.bubblegum,
      S.chilli,
      S.papaya,
      S.dustyMauve,
      S.espresso,
      S.blackCherry,
    ],
    size: '4 ml',
    soldOut: [5],
    has3d: true,
    isNew: true,
    rating: 4.5,
    ratingCount: 64,
    tags: ['liquid lipstick', 'lipstick', 'matte', 'transfer-proof', 'long-wear'],
    about:
      'A featherlight liquid lipstick that dries to a transfer-proof matte in under a minute. Eight shades from soft nudes to deep berry.',
    benefits: ['Transfer-proof once set', 'Lasts through meals', 'Precise doe-foot applicator'],
    howToUse:
      'Outline the lips with the tip of the applicator, then fill in. Keep the lips apart for 30 seconds while it sets.',
    ingredients:
      'Isododecane, Dimethicone, Trimethylsiloxysilicate, Kaolin, Disteardimonium Hectorite, Propylene Carbonate, Phenoxyethanol, Tocopheryl Acetate, [+/- CI 15850, CI 45410, CI 77491, CI 77891]',
    reviews: [
      {
        by: 1,
        rating: 5,
        title: 'Truly transfer-proof',
        body: 'Survived a full biryani lunch. Caramel Nude is the perfect everyday shade.',
      },
      {
        by: 0,
        rating: 4,
        title: 'Bold and long-lasting',
        body: 'Chilli is a stunning red. It needs lip balm underneath as it is quite matte.',
        photo: true,
      },
      {
        by: 3,
        rating: 3,
        title: 'Great colour, a little drying',
        body: 'The pigment is amazing but my lips feel dry after six hours.',
      },
    ],
  },
  {
    slug: 'glow-tinted-lip-balm',
    title: 'Tinted Lip Balm SPF 15',
    kind: 'lipstick',
    brandId: 'br-glow',
    sellerId: 'sel-glow',
    categoryId: 'cat-lips',
    price: 950,
    compareAt: 1100,
    shades: [S.sheerNude, S.peony, S.peach, S.berryFlush],
    size: '4 g',
    has3d: true,
    rating: 4.6,
    ratingCount: 133,
    tags: ['lip balm', 'tinted', 'spf', 'sun protection', 'hydrating'],
    about:
      'A sheer tinted balm with SPF 15 that protects and softens lips in the sun. Just enough colour for school runs, errands and the gym.',
    benefits: [
      'SPF 15 sun protection',
      'Sheer, buildable tint',
      'Softens with shea and coconut oil',
    ],
    howToUse:
      'Apply generously to the lips before going out and reapply every two hours in the sun.',
    ingredients:
      'Ethylhexyl Methoxycinnamate, Ricinus Communis (Castor) Seed Oil, Butyrospermum Parkii (Shea) Butter, Cera Alba, Cocos Nucifera (Coconut) Oil, Tocopherol, Aroma, [+/- CI 15850, CI 77491]',
  },
  {
    slug: 'velvet-skin-tint',
    title: 'Second Skin Tint SPF 20',
    kind: 'tube',
    brandId: 'br-velvet',
    sellerId: 'sel-velvet',
    categoryId: 'cat-face',
    price: 3200,
    compareAt: 3800,
    shades: [S.porcelain, S.ivory, S.sand, S.honey, S.caramel, S.mocha],
    size: '30 ml',
    isNew: true,
    rating: 4.4,
    ratingCount: 58,
    skin: ['normal', 'dry', 'combination'],
    tags: ['skin tint', 'foundation', 'spf', 'light coverage', 'dewy'],
    about:
      'A breathable skin tint with light coverage, a dewy finish and SPF 20. Niacinamide and hyaluronic acid care for the skin underneath.',
    benefits: [
      'Evens the skin tone, still looks like skin',
      'SPF 20 for everyday wear',
      'Six shades for South Asian undertones',
    ],
    howToUse:
      'Shake well. Dot onto the face and blend outwards with fingertips or a damp sponge. Build a second layer where needed.',
    ingredients:
      'Aqua, Cyclopentasiloxane, Ethylhexyl Methoxycinnamate, Glycerin, Niacinamide, Titanium Dioxide, Sodium Hyaluronate, Phenoxyethanol, [+/- CI 77891, CI 77491, CI 77492, CI 77499]',
  },
  {
    slug: 'mehr-cream-blush-stick',
    title: 'Cream Blush Stick',
    kind: 'lipstick',
    brandId: 'br-mehr',
    sellerId: 'sel-chandni',
    categoryId: 'cat-face',
    price: 1350,
    shades: [S.candy, S.peach, S.rosewood, S.cinnamon],
    size: '7 g',
    rating: 4.2,
    ratingCount: 29,
    skin: ['dry', 'normal'],
    tags: ['blush', 'cream blush', 'stick', 'multi-use'],
    about:
      'A creamy blush stick that melts into the skin for a fresh, dewy flush. It doubles as a lip tint for a quick matching look.',
    benefits: ['Dewy, skin-like finish', 'Cheeks and lips in one', 'Easy to blend with fingertips'],
    howToUse:
      'Dab two or three dots onto the cheeks and blend with fingertips. Tap a little on the lips for a matching tint.',
    ingredients:
      'Caprylic/Capric Triglyceride, Polyethylene, Octyldodecanol, Silica, Tocopheryl Acetate, [+/- CI 15850, CI 77491, CI 77891]',
  },
  {
    slug: 'dewy-setting-spray',
    title: 'Dewy Fix Setting Spray',
    kind: 'bottle',
    brandId: 'br-dewy',
    sellerId: 'sel-sahil',
    categoryId: 'cat-face',
    price: 1650,
    compareAt: 1950,
    size: '100 ml',
    rating: 4.3,
    ratingCount: 81,
    skin: ALL_SKIN,
    tags: ['setting spray', 'makeup fix', 'long-wear', 'humidity-proof'],
    about:
      'A fine-mist setting spray that locks makeup in place through heat and humidity. Aloe and rose water refresh the skin during the day.',
    benefits: [
      'Locks makeup for up to 12 hours',
      'Humidity-proof finish',
      'Refreshing rose water mist',
    ],
    howToUse:
      'Hold 20 cm from the face and mist in an X and T shape after makeup. Let it dry without touching.',
    ingredients:
      'Aqua, Alcohol Denat., Glycerin, PVP, Aloe Barbadensis Leaf Juice, Panthenol, Rosa Damascena Flower Water, Phenoxyethanol',
  },
  {
    slug: 'surmai-kohl-pencil',
    title: 'Kohl Kajal Pencil',
    kind: 'mascara',
    brandId: 'br-surmai',
    sellerId: 'sel-chandni',
    categoryId: 'cat-eyes',
    price: 650,
    size: '1.1 g',
    hasVideo: true,
    rating: 4.6,
    ratingCount: 412,
    tags: ['kohl', 'kajal', 'eyeliner', 'waterproof', 'smudge-proof'],
    about:
      'An intensely black, lead-free kajal that glides onto the waterline and stays sharp all day. Castor oil and carnauba wax keep it smooth and gentle on the eyes.',
    benefits: [
      'Deep black in one stroke',
      'Waterproof and smudge-proof',
      'Lead-free and ophthalmologist tested',
    ],
    howToUse:
      'Draw along the upper and lower waterline. Smudge the outer corners with a fingertip for a smoky look.',
    ingredients:
      'Hydrogenated Castor Oil, Cera Alba, Copernicia Cerifera (Carnauba) Wax, Ricinus Communis (Castor) Seed Oil, Tocopheryl Acetate, CI 77499',
    reviews: [
      {
        by: 3,
        rating: 5,
        title: 'The deepest black kajal',
        body: 'Glides on my waterline and does not smudge even in the heat.',
      },
      {
        by: 2,
        rating: 5,
        title: 'Finally a kohl that lasts',
        body: 'I wore it through a wedding and it stayed sharp until midnight.',
      },
      {
        by: 4,
        rating: 4,
        title: 'Great for the price',
        body: 'Very dark and smooth. Sharpen it gently; the tip is soft.',
      },
      {
        by: 0,
        rating: 5,
        title: 'Gentle on my eyes',
        body: 'My eyes are sensitive and this one never stings. Buying a second one.',
      },
    ],
  },
  {
    slug: 'surmai-volume-mascara',
    title: 'Lash Volume Mascara',
    kind: 'mascara',
    brandId: 'br-surmai',
    sellerId: 'sel-chandni',
    categoryId: 'cat-eyes',
    price: 1250,
    compareAt: 1500,
    size: '10 ml',
    rating: 4.4,
    ratingCount: 156,
    tags: ['mascara', 'volume', 'lengthening', 'clump-free'],
    about:
      'A volumising mascara with an hourglass brush that coats every lash from root to tip. Buildable volume without clumps or flakes.',
    benefits: [
      'Instant volume and length',
      'Clump-free, flake-free wear',
      'Washes off with warm water',
    ],
    howToUse:
      'Wiggle the brush from the root of the lashes to the tips. Add a second coat before the first one dries.',
    ingredients:
      'Aqua, Cera Alba, Stearic Acid, Copernicia Cerifera (Carnauba) Wax, Acacia Senegal Gum, Hydroxyethylcellulose, Panthenol, Phenoxyethanol, CI 77499',
  },
  {
    slug: 'glow-liquid-eyeliner',
    title: 'Precision Liquid Eyeliner',
    kind: 'mascara',
    brandId: 'br-glow',
    sellerId: 'sel-glow',
    categoryId: 'cat-eyes',
    price: 1100,
    size: '3 ml',
    isNew: true,
    rating: 4.5,
    ratingCount: 37,
    tags: ['eyeliner', 'liquid liner', 'winged liner', 'waterproof'],
    about:
      'A felt-tip liquid liner with a fine, flexible point for crisp wings. Carbon-black pigment that dries in seconds.',
    benefits: ['Fine tip for sharp wings', 'Dries in seconds', 'Waterproof all day'],
    howToUse:
      'Rest your elbow on a table and draw short strokes from the inner to the outer corner, then flick out the wing.',
    ingredients:
      'Aqua, Styrene/Acrylates Copolymer, Butylene Glycol, Glycerin, Polysorbate 20, Phenoxyethanol, CI 77266',
  },
  {
    slug: 'lumiere-brow-pomade',
    title: 'Brow Sculpt Pomade',
    kind: 'jar',
    brandId: 'br-lumiere',
    sellerId: 'sel-beautypoint',
    categoryId: 'cat-eyes',
    price: 1350,
    shades: [S.softTaupe, S.chestnut, S.espresso],
    size: '4 g',
    rating: 3.8,
    ratingCount: 22,
    tags: ['brow', 'eyebrow pomade', 'waterproof', 'long-wear'],
    about:
      'A waterproof brow pomade that fills sparse brows with natural, hair-like strokes and holds them in place all day.',
    benefits: [
      'Natural, hair-like strokes',
      'Holds brows all day',
      'Three shades from taupe to espresso',
    ],
    howToUse:
      'Pick up a little product with an angled brush, wipe off the excess and draw light strokes in the direction of hair growth.',
    ingredients:
      'Isododecane, Cera Microcristallina, Synthetic Beeswax, Trimethylsiloxysilicate, Tocopherol, [+/- CI 77491, CI 77492, CI 77499]',
  },
  {
    slug: 'sheen-niacinamide-serum',
    title: 'Niacinamide 10% Clarifying Serum',
    kind: 'serum',
    brandId: 'br-sheen',
    sellerId: 'sel-skinlab',
    categoryId: 'cat-skincare',
    price: 2450,
    compareAt: 2800,
    size: '30 ml',
    hasVideo: true,
    rating: 4.7,
    ratingCount: 221,
    skin: ['oily', 'combination'],
    tags: ['niacinamide', 'serum', 'pores', 'oil control', 'acne-prone'],
    about:
      'A clarifying serum with 10% niacinamide and zinc that visibly refines pores and balances oily, breakout-prone skin.',
    benefits: [
      'Refines the look of pores',
      'Balances oil through the day',
      'Calms breakout-prone skin',
    ],
    howToUse:
      'Apply a few drops to clean skin morning and evening before heavier creams. Always follow with sunscreen in the morning.',
    ingredients:
      'Aqua, Niacinamide, Pentylene Glycol, Zinc PCA, Tamarindus Indica Seed Gum, Xanthan Gum, Phenoxyethanol, Ethylhexylglycerin',
    reviews: [
      {
        by: 0,
        rating: 5,
        title: 'Pores look smaller',
        body: 'My oily T-zone is calmer and my makeup lasts longer.',
      },
      {
        by: 4,
        rating: 4,
        title: 'Helped my breakouts',
        body: 'Fewer spots after a month. Slightly tacky for a minute, then it dries down.',
      },
      {
        by: 2,
        rating: 5,
        title: 'Clear skin, fast delivery',
        body: 'Arrived in three days. My skin texture feels smoother already.',
      },
    ],
  },
  {
    slug: 'sheen-spf50-sunscreen',
    title: 'Invisible Sunscreen SPF 50',
    kind: 'tube',
    brandId: 'br-sheen',
    sellerId: 'sel-sahil',
    categoryId: 'cat-skincare',
    price: 1850,
    size: '50 ml',
    isNew: true,
    rating: 4.5,
    ratingCount: 98,
    skin: ALL_SKIN,
    tags: ['sunscreen', 'spf', 'sun protection', 'no white cast', 'broad spectrum'],
    about:
      'A weightless, broad-spectrum SPF 50 gel-cream that disappears on every skin tone. No white cast, no greasy shine, made for Pakistani summers.',
    benefits: [
      'SPF 50 broad-spectrum protection',
      'No white cast on deeper skin',
      'Works under makeup',
    ],
    howToUse:
      'Apply two finger lengths to the face and neck as the last step of your morning routine. Reapply every two hours outdoors.',
    ingredients:
      'Aqua, Homosalate, Ethylhexyl Salicylate, Butyl Methoxydibenzoylmethane, Octocrylene, Glycerin, Niacinamide, Tocopheryl Acetate, Phenoxyethanol',
  },
  {
    slug: 'damask-rose-toner',
    title: 'Damask Rose Toner',
    kind: 'bottle',
    brandId: 'br-rose',
    sellerId: 'sel-rosehouse',
    categoryId: 'cat-skincare',
    price: 1950,
    size: '150 ml',
    rating: 4.7,
    ratingCount: 84,
    skin: ALL_SKIN,
    tags: ['toner', 'rose water', 'hydrating', 'alcohol-free'],
    about:
      'An alcohol-free toner of steam-distilled damask rose water with aloe and panthenol. It refreshes, balances and preps the skin for serums.',
    benefits: ['Alcohol-free and gentle', 'Hydrates and soothes', 'Preps skin for serums'],
    howToUse:
      'After cleansing, sweep over the face with a cotton pad or press in with the palms. Use morning and evening.',
    ingredients:
      'Rosa Damascena Flower Water, Glycerin, Aloe Barbadensis Leaf Juice, Panthenol, Allantoin, Sodium PCA, Phenoxyethanol',
  },
  {
    slug: 'chambeli-jasmine-attar',
    title: 'Jasmine Night Attar',
    kind: 'perfume',
    brandId: 'br-chambeli',
    sellerId: 'sel-sahil',
    categoryId: 'cat-fragrance',
    price: 2200,
    size: '12 ml',
    has3d: true,
    rating: 4.6,
    ratingCount: 143,
    tags: ['attar', 'perfume oil', 'jasmine', 'alcohol-free', 'floral'],
    about:
      'An alcohol-free perfume oil of night-blooming jasmine on a sandalwood base, in a roll-on bottle for the handbag.',
    benefits: ['Alcohol-free perfume oil', 'Lasts all day from one dab', 'Handy roll-on'],
    howToUse:
      'Roll a little onto the wrists and behind the ears. A drop on a cotton bud freshens clothes and scarves.',
    ingredients:
      'Santalum Album (Sandalwood) Oil, Parfum, Jasminum Grandiflorum Flower Extract, Benzyl Benzoate, Linalool, Benzyl Alcohol',
    reviews: [
      {
        by: 4,
        rating: 5,
        title: 'Like fresh motia flowers',
        body: 'A tiny dab on the wrist lasts all day. Alcohol-free, which I prefer.',
      },
      {
        by: 3,
        rating: 4,
        title: 'Lovely traditional scent',
        body: 'Reminds me of my grandmother. The roll-on is handy for my handbag.',
      },
    ],
  },
  {
    slug: 'chambeli-body-mist',
    title: 'Garden Body Mist',
    kind: 'bottle',
    brandId: 'br-chambeli',
    sellerId: 'sel-sahil',
    categoryId: 'cat-fragrance',
    price: 1450,
    compareAt: 1700,
    size: '200 ml',
    rating: 3.9,
    ratingCount: 67,
    tags: ['body mist', 'body spray', 'floral', 'fresh'],
    about:
      'A light, fresh body mist of jasmine, green leaves and pear for everyday wear. Spray freely after a shower or at the gym.',
    benefits: ['Light, fresh scent', 'Generous 200 ml bottle', 'Refreshes on the go'],
    howToUse: 'Mist over the body and hair after a bath or whenever you need a refresh.',
    ingredients:
      'Aqua, Alcohol Denat., Parfum, Glycerin, Polysorbate 20, Linalool, Benzyl Benzoate',
  },
  {
    slug: 'saffron-amber-eau-de-parfum',
    title: 'Amber Saffron Eau de Parfum',
    kind: 'perfume',
    brandId: 'br-saffron',
    sellerId: 'sel-beautypoint',
    categoryId: 'cat-fragrance',
    price: 4200,
    sizes: [
      { label: '30 ml', price: 4200 },
      { label: '100 ml', price: 11500 },
    ],
    has3d: true,
    isNew: true,
    rating: 4.5,
    ratingCount: 31,
    tags: ['perfume', 'eau de parfum', 'amber', 'saffron', 'warm'],
    about:
      'A warm amber fragrance with saffron, cardamom and vanilla over smoky woods. Cosy in winter and elegant at evening events.',
    benefits: [
      'Warm amber and saffron accord',
      'Long-lasting on skin and clothes',
      'Two bottle sizes',
    ],
    howToUse:
      'Spray on the pulse points and the inside of the elbows. One spray on a scarf lasts for days.',
    ingredients: INCI.perfume,
  },
  {
    slug: 'chambeli-white-musk',
    title: 'White Musk Eau de Toilette',
    kind: 'perfume',
    brandId: 'br-chambeli',
    sellerId: 'sel-gulposh',
    categoryId: 'cat-fragrance',
    price: 3500,
    size: '100 ml',
    rating: 4.2,
    ratingCount: 44,
    tags: ['perfume', 'eau de toilette', 'musk', 'clean', 'everyday'],
    about:
      'A clean, powdery white musk with soft florals, made for the office and everyday wear. Light enough to spray without a second thought.',
    benefits: ['Clean, soft musk scent', 'Office-friendly strength', 'Generous 100 ml bottle'],
    howToUse: 'Spray on the neck and wrists, or mist into the air and walk through it.',
    ingredients: INCI.perfume,
  },
  {
    slug: 'rose-shea-hand-cream',
    title: 'Rose & Shea Hand Cream',
    kind: 'tube',
    brandId: 'br-rose',
    sellerId: 'sel-rosehouse',
    categoryId: 'cat-body',
    price: 1150,
    size: '75 ml',
    rating: 4.7,
    ratingCount: 118,
    skin: ['dry', 'sensitive'],
    tags: ['hand cream', 'moisturiser', 'shea butter', 'rose'],
    about:
      'A fast-absorbing hand cream with shea butter and our damask rose water. It softens dry hands without leaving a greasy film.',
    benefits: ['Absorbs in seconds', 'Softens dry, rough hands', 'Gentle rose scent'],
    howToUse: 'Massage into the hands and cuticles as often as needed, especially after washing.',
    ingredients:
      'Aqua, Glycerin, Butyrospermum Parkii (Shea) Butter, Cetearyl Alcohol, Rosa Damascena Flower Water, Dimethicone, Allantoin, Phenoxyethanol, Parfum',
    reviews: [
      {
        by: 2,
        rating: 5,
        title: 'Soft hands all day',
        body: 'Absorbs fast and does not leave my phone greasy. The rose scent is gentle.',
      },
      {
        by: 1,
        rating: 5,
        title: 'A perfect gift',
        body: 'Bought three for my sisters. A lovely tube and a very caring seller.',
      },
    ],
  },
  {
    slug: 'chambeli-body-lotion',
    title: 'Jasmine Body Lotion',
    kind: 'bottle',
    brandId: 'br-chambeli',
    sellerId: 'sel-sahil',
    categoryId: 'cat-body',
    price: 1350,
    size: '250 ml',
    rating: 4.3,
    ratingCount: 52,
    skin: ['normal', 'dry'],
    tags: ['body lotion', 'moisturiser', 'jasmine', 'lightweight'],
    about:
      'A lightweight daily body lotion with niacinamide and jasmine extract that leaves skin soft, even and lightly scented.',
    benefits: ['Lightweight, non-sticky', 'Evens skin with niacinamide', 'Soft jasmine scent'],
    howToUse: 'Smooth over the body after a shower while the skin is still slightly damp.',
    ingredients:
      'Aqua, Glycerin, Caprylic/Capric Triglyceride, Cetearyl Alcohol, Jasminum Officinale Flower Extract, Niacinamide, Carbomer, Phenoxyethanol, Parfum',
  },
  {
    slug: 'dewy-coffee-body-scrub',
    title: 'Coffee & Sugar Body Scrub',
    kind: 'jar',
    brandId: 'br-dewy',
    sellerId: 'sel-gulposh',
    categoryId: 'cat-body',
    price: 1250,
    size: '250 g',
    has3d: true,
    isNew: true,
    rating: 4.4,
    ratingCount: 27,
    skin: ['normal', 'oily', 'combination'],
    tags: ['body scrub', 'exfoliator', 'coffee', 'smoothing'],
    about:
      'An energising scrub of ground coffee and sugar in coconut and almond oil. It buffs away dull skin and leaves the body smooth and glowing.',
    benefits: [
      'Buffs away dull, rough skin',
      'Leaves a nourishing oil layer',
      'Invigorating coffee scent',
    ],
    howToUse:
      'Massage onto damp skin in circles two or three times a week, then rinse. Avoid broken or sunburnt skin.',
    ingredients:
      'Sucrose, Coffea Arabica (Coffee) Seed Powder, Cocos Nucifera (Coconut) Oil, Prunus Amygdalus Dulcis (Sweet Almond) Oil, Tocopherol, Parfum',
  },
  {
    slug: 'saffron-ubtan-body-polish',
    title: 'Ubtan Body Polish',
    kind: 'jar',
    brandId: 'br-saffron',
    sellerId: 'sel-gulposh',
    categoryId: 'cat-body',
    price: 1650,
    compareAt: 1900,
    size: '200 g',
    rating: 4.6,
    ratingCount: 73,
    skin: ALL_SKIN,
    tags: ['ubtan', 'body polish', 'turmeric', 'brightening', 'bridal'],
    about:
      'The traditional pre-wedding ubtan, ready to use: gram flour, turmeric, sandalwood and saffron in rose water for bright, soft skin.',
    benefits: [
      'Gently brightens and polishes',
      'Traditional bridal ritual',
      'No harsh scrubbing grains',
    ],
    howToUse:
      'Spread a thin layer over damp skin, leave for five minutes, then rub off gently with wet hands and rinse.',
    ingredients:
      'Cicer Arietinum (Gram) Flour, Curcuma Longa (Turmeric) Root Powder, Santalum Album (Sandalwood) Wood Powder, Rosa Damascena Flower Water, Glycerin, Crocus Sativus (Saffron) Flower Extract, Phenoxyethanol',
  },
  {
    slug: 'sheen-foot-repair-cream',
    title: 'Urea Foot Repair Cream',
    kind: 'tube',
    brandId: 'br-sheen',
    sellerId: 'sel-skinlab',
    categoryId: 'cat-body',
    price: 980,
    size: '100 ml',
    outOfStock: true,
    rating: 3.7,
    ratingCount: 33,
    skin: ['dry'],
    tags: ['foot cream', 'cracked heels', 'urea', 'moisturiser'],
    about:
      'An intensive foot cream with 10% urea and lactic acid that softens hard skin and cracked heels within days.',
    benefits: ['Softens cracked heels', '10% urea for rough skin', 'Cooling peppermint'],
    howToUse:
      'Massage into clean, dry feet at night, focusing on the heels. Wear cotton socks for best results.',
    ingredients:
      'Aqua, Urea, Glycerin, Butyrospermum Parkii (Shea) Butter, Cetearyl Alcohol, Lactic Acid, Mentha Piperita (Peppermint) Oil, Phenoxyethanol',
  },
  {
    slug: 'amla-bhringraj-hair-oil',
    title: 'Amla & Bhringraj Hair Oil',
    kind: 'bottle',
    brandId: 'br-amla',
    sellerId: 'sel-gulposh',
    categoryId: 'cat-hair',
    price: 950,
    compareAt: 1150,
    size: '200 ml',
    hasVideo: true,
    rating: 4.7,
    ratingCount: 356,
    tags: ['hair oil', 'amla', 'hair fall', 'champi', 'herbal'],
    about:
      'A classic champi oil of cold-pressed sesame and coconut oils infused with amla, bhringraj and methi, for stronger roots and less hair fall.',
    benefits: [
      'Reduces hair fall from breakage',
      'Nourishes the scalp',
      'Light enough to wash out easily',
    ],
    howToUse:
      'Warm a little oil and massage into the scalp for five minutes. Leave for at least an hour or overnight, then shampoo.',
    ingredients:
      'Sesamum Indicum (Sesame) Seed Oil, Cocos Nucifera (Coconut) Oil, Emblica Officinalis (Amla) Fruit Extract, Eclipta Prostrata (Bhringraj) Extract, Trigonella Foenum-Graecum (Methi) Seed Extract, Tocopherol',
    reviews: [
      {
        by: 1,
        rating: 5,
        title: 'Less hair fall',
        body: 'After a month of weekly champi my hair fall is visibly less.',
      },
      {
        by: 3,
        rating: 4,
        title: 'Traditional and effective',
        body: 'A strong herbal smell, but it works. I leave it on overnight.',
      },
      {
        by: 0,
        rating: 5,
        title: 'Just like home-made',
        body: 'Light enough to wash out with one shampoo. My hair feels thicker.',
      },
    ],
  },
  {
    slug: 'amla-onion-shampoo',
    title: 'Onion & Amla Shampoo',
    kind: 'bottle',
    brandId: 'br-amla',
    sellerId: 'sel-gulposh',
    categoryId: 'cat-hair',
    price: 1100,
    sizes: [
      { label: '200 ml', price: 1100 },
      { label: '400 ml', price: 1900 },
    ],
    rating: 4.3,
    ratingCount: 140,
    tags: ['shampoo', 'hair fall', 'onion', 'amla', 'strengthening'],
    about:
      'A gentle strengthening shampoo with onion and amla extracts that cleans without stripping and helps reduce hair fall.',
    benefits: ['Cleans gently without stripping', 'Helps reduce hair fall', 'Two sizes'],
    howToUse:
      'Lather into wet hair and scalp, massage for a minute and rinse. Follow with conditioner on the lengths.',
    ingredients:
      'Aqua, Sodium Laureth Sulfate, Cocamidopropyl Betaine, Allium Cepa (Onion) Bulb Extract, Emblica Officinalis (Amla) Fruit Extract, Glycerin, Panthenol, Sodium Chloride, Parfum, Phenoxyethanol',
  },
  {
    slug: 'amla-leave-in-conditioner',
    title: 'Leave-in Silk Conditioner',
    kind: 'tube',
    brandId: 'br-amla',
    sellerId: 'sel-gulposh',
    categoryId: 'cat-hair',
    price: 1250,
    size: '150 ml',
    isNew: true,
    rating: 4.2,
    ratingCount: 18,
    tags: ['conditioner', 'leave-in', 'detangling', 'frizz control'],
    about:
      'A lightweight leave-in conditioner with silk protein and amla that detangles, softens and keeps frizz down between washes.',
    benefits: ['Detangles instantly', 'Softens without weighing down', 'Keeps frizz away'],
    howToUse: 'Smooth a small amount through towel-dried lengths and ends. Do not rinse.',
    ingredients:
      'Aqua, Cetearyl Alcohol, Behentrimonium Chloride, Hydrolyzed Silk, Emblica Officinalis (Amla) Fruit Extract, Panthenol, Dimethicone, Parfum, Phenoxyethanol',
  },
  {
    slug: 'dewy-repair-hair-mask',
    title: 'Deep Repair Hair Mask',
    kind: 'jar',
    brandId: 'br-dewy',
    sellerId: 'sel-beautypoint',
    categoryId: 'cat-hair',
    price: 1850,
    compareAt: 2200,
    size: '250 ml',
    rating: 4.5,
    ratingCount: 66,
    tags: ['hair mask', 'deep conditioning', 'keratin', 'damaged hair'],
    about:
      'A rich weekly mask with keratin, shea butter and argan oil that repairs dry, coloured and heat-damaged hair.',
    benefits: ['Repairs dry, damaged ends', 'Adds softness and shine', 'Safe for coloured hair'],
    howToUse:
      'After shampoo, apply to the lengths, leave for 10 minutes under a warm towel, then rinse well.',
    ingredients: `${INCI.conditioner}, Hydrolyzed Keratin, Argania Spinosa (Argan) Kernel Oil`,
  },
  {
    slug: 'rose-hair-scalp-mist',
    title: 'Rose Hair & Scalp Mist',
    kind: 'bottle',
    brandId: 'br-rose',
    sellerId: 'sel-rosehouse',
    categoryId: 'cat-hair',
    price: 1600,
    size: '100 ml',
    rating: 4.4,
    ratingCount: 27,
    tags: ['hair mist', 'scalp care', 'rose water', 'hair perfume'],
    about:
      'A refreshing mist of damask rose water and rice protein that soothes the scalp and leaves hair lightly scented between washes.',
    benefits: ['Soothes a dry scalp', 'Light rose scent for hair', 'Adds softness without oil'],
    howToUse: 'Mist over the scalp and hair from 20 cm away. Use daily or after styling.',
    ingredients:
      'Rosa Damascena Flower Water, Aqua, Glycerin, Panthenol, Hydrolyzed Rice Protein, Parfum, Phenoxyethanol',
  },
  {
    slug: 'qalam-pro-brush-set',
    title: 'Pro 12-Piece Brush Set',
    kind: 'brush',
    brandId: 'br-qalam',
    sellerId: 'sel-chandni',
    categoryId: 'cat-tools',
    price: 4800,
    compareAt: 5600,
    hasVideo: true,
    rating: 4.8,
    ratingCount: 91,
    tags: ['brush set', 'makeup brushes', 'vegan', 'travel pouch'],
    about:
      'Twelve face and eye brushes for a full look, from a fluffy powder brush to a precise liner brush, in a vegan leather roll-up pouch.',
    benefits: [
      'Everything for face and eyes',
      'Soft, cruelty-free bristles',
      'Travel roll-up pouch',
    ],
    howToUse:
      'Use the large brushes for powder, blush and bronzer, the flat and dense ones for base, and the small ones for eyes. Wash weekly.',
    ingredients:
      'Synthetic taklon and nylon bristles, aluminium ferrules, wooden handles, polyurethane pouch',
  },
  {
    slug: 'qalam-blending-sponge',
    title: 'Blending Sponge Duo',
    kind: 'brush',
    brandId: 'br-qalam',
    sellerId: 'sel-chandni',
    categoryId: 'cat-tools',
    price: 750,
    rating: 4.3,
    ratingCount: 204,
    tags: ['sponge', 'beauty blender', 'foundation', 'latex-free'],
    about: 'Two latex-free makeup sponges that swell when damp for a seamless, streak-free base.',
    benefits: ['Streak-free blending', 'Latex-free foam', 'Pointed tip for under the eyes'],
    howToUse:
      'Wet the sponge, squeeze out excess water and bounce foundation or concealer onto the skin.',
    ingredients: 'Latex-free polyurethane foam',
  },
  {
    slug: 'qalam-eyelash-curler',
    title: 'Gold Eyelash Curler',
    kind: 'brush',
    brandId: 'br-qalam',
    sellerId: 'sel-gulposh',
    categoryId: 'cat-tools',
    price: 900,
    outOfStock: true,
    rating: 3.6,
    ratingCount: 12,
    tags: ['eyelash curler', 'lashes', 'curl'],
    about:
      'A gold-plated eyelash curler with a wide curve that fits South Asian eye shapes and a spare silicone pad.',
    benefits: ['Wide curve for more eye shapes', 'Gentle silicone pad', 'Spare pad included'],
    howToUse:
      'Place the curler at the base of clean lashes, squeeze gently for five seconds, then apply mascara.',
    ingredients: 'Gold-plated stainless steel, silicone pads',
  },
  {
    slug: 'lumiere-fan-brush',
    title: 'Highlighter Fan Brush',
    kind: 'brush',
    brandId: 'br-lumiere',
    sellerId: 'sel-beautypoint',
    categoryId: 'cat-tools',
    price: 1150,
    rating: 4.4,
    ratingCount: 26,
    tags: ['brush', 'fan brush', 'highlighter brush'],
    about:
      'A feather-light fan brush that places highlighter exactly where the light hits, without overdoing it.',
    benefits: ['Precise, soft highlight', 'Also sweeps away fallout', 'Vegan bristles'],
    howToUse:
      'Tap lightly into highlighter and sweep along the cheekbone, then down the bridge of the nose.',
    ingredients: 'Synthetic taklon bristles, gold-tone aluminium ferrule, birch wood handle',
  },
  {
    slug: 'rose-quartz-face-roller',
    title: 'Rose Quartz Face Roller',
    kind: 'brush',
    brandId: 'br-sheen',
    sellerId: 'sel-sahil',
    categoryId: 'cat-tools',
    price: 2400,
    rating: 4.5,
    ratingCount: 47,
    tags: ['face roller', 'rose quartz', 'facial massage', 'de-puffing'],
    about:
      'A dual-ended rose quartz roller for a cooling facial massage that helps de-puff the morning face and press serums in.',
    benefits: ['Cooling, de-puffing massage', 'Helps serums absorb', 'Genuine rose quartz'],
    howToUse:
      'Roll upwards and outwards from the centre of the face after applying serum. Keep it in the fridge for an extra cool feel.',
    ingredients: 'Rose quartz stone, zinc alloy frame',
  },
];

const storeById = new Map(storeSeeds.map((s) => [s.id, s]));
const brandById = new Map(brands.map((b) => [b.id, b]));

/** Placeholder art per kind, 800 × 1000: view 1 on a light backdrop, view 2 on a deeper one. */
function imageFor(seed: Seed, view: 1 | 2) {
  return img(seed.kind, view === 1 ? seed.title : `${seed.title}, alternate view`, view);
}

const MODEL_KINDS = ['lipstick', 'compact', 'perfume', 'jar'] as const;
type ModelKind = (typeof MODEL_KINDS)[number];
const isModelKind = (kind: Kind): kind is ModelKind =>
  (MODEL_KINDS as readonly string[]).includes(kind);

function mediaFor(seed: Seed): ProductMedia[] {
  const list: ProductMedia[] = ([1, 2] as const).map((view) => ({
    id: `${seed.slug}-img-${view}`,
    type: 'image',
    url: imageFor(seed, view).url,
    posterUrl: null,
    alt: imageFor(seed, view).alt,
    model3dKind: null,
  }));
  if (seed.hasVideo) {
    list.push({
      id: `${seed.slug}-video`,
      type: 'video',
      // Loop rendered from our 3D stage (apps/web/scripts/render-ad-loop.mjs). [CONFIRM] real
      // product videos come from Stream/Mux.
      url: '/placeholders/video-placeholder.webm',
      posterUrl: `/placeholders/${seed.kind}-2.svg`,
      alt: `${seed.title} video`,
      model3dKind: null,
    });
  }
  if (seed.has3d) {
    list.push({
      id: `${seed.slug}-3d`,
      type: 'model3d',
      url: '',
      posterUrl: null,
      alt: `3D view of ${seed.title}`,
      model3dKind: isModelKind(seed.kind) ? seed.kind : null,
    });
  }
  return list;
}

/** Variants cheapest first (the API lists them by price, then in the seller's order). */
function variantsFor(seed: Seed): Variant[] {
  const options: { shade: Shade | null; size: Size }[] = seed.sizes
    ? seed.sizes.map((size) => ({ shade: null, size }))
    : (seed.shades?.length ? seed.shades : [null]).map((shade) => ({
        shade,
        size: { label: seed.size ?? '', price: seed.price, compareAt: seed.compareAt },
      }));
  return options.map(({ shade, size }, i) => ({
    id: `${seed.slug}-v${i + 1}`,
    sku: `${seed.slug.toUpperCase().slice(0, 12)}-${i + 1}`,
    shadeName: shade?.name ?? null,
    shadeHex: shade?.hex ?? null,
    sizeLabel: size.label || null,
    price: rupees(size.price),
    compareAtPrice: size.compareAt ? rupees(size.compareAt) : null,
    currency: 'PKR' as const,
    stock: seed.outOfStock || seed.soldOut?.includes(i) ? 0 : 25 + i * 5,
  }));
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A paragraph and a list of three benefits: only tags the description sanitizer allows. */
function descriptionHtml(seed: Seed): string {
  const items = seed.benefits.map((b) => `<li>${escapeHtml(b)}</li>`).join('');
  return `<p>${escapeHtml(seed.about)}</p><ul>${items}</ul>`;
}

function toProduct(seed: Seed, index: number): Product {
  const store = storeById.get(seed.sellerId);
  const brand = brandById.get(seed.brandId);
  if (!store || !brand) throw new Error(`Bad fixture: ${seed.slug}`);
  const variants = variantsFor(seed);
  const cheapest = variants[0];
  if (!cheapest) throw new Error(`Bad fixture: ${seed.slug} has no variants`);
  const onlyVariant = variants.length === 1 ? cheapest : undefined;
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
    images: [imageFor(seed, 1), imageFor(seed, 2)],
    price: cheapest.price,
    compareAtPrice: cheapest.compareAtPrice,
    currency: 'PKR',
    shades: (seed.shades ?? []).map(({ name, hex }) => ({ name, hex })),
    rating: seed.rating,
    ratingCount: seed.ratingCount,
    has3d: seed.has3d ?? false,
    hasVideo: seed.hasVideo ?? false,
    isNew: seed.isNew ?? false,
    sponsored: false,
    quickAddVariantId: onlyVariant && onlyVariant.stock > 0 ? onlyVariant.id : null,
    descriptionHtml: descriptionHtml(seed),
    howToUse: seed.howToUse,
    ingredients: seed.ingredients,
    skinTypes: seed.skin ?? [],
    tags: seed.tags,
    variants,
    media: mediaFor(seed),
    soldCount: seed.ratingCount * 3,
  };
}

export const products: Product[] = seeds.map(toProduct);

/**
 * Store rating = the average product rating weighted by number of ratings (one decimal), and
 * the number of products — computed the way the API computes them from the seeded rows.
 */
export const stores: Store[] = storeSeeds.map((s) => {
  const own = products.filter((p) => p.seller.id === s.id);
  const ratings = own.reduce((n, p) => n + p.ratingCount, 0);
  const sum = own.reduce((total, p) => total + p.rating * p.ratingCount, 0);
  return {
    ...s,
    rating: ratings ? Math.round((sum / ratings) * 10) / 10 : 0,
    productCount: own.length,
  };
});

/** Demo shoppers (the seed makes one account per author). */
export const REVIEW_AUTHORS = [
  'Ayesha K.',
  'Sana R.',
  'Mehwish A.',
  'Hira S.',
  'Fatima Z.',
] as const;

const NEWEST_REVIEW_AT = Date.parse('2026-09-27T10:00:00.000Z');
const REVIEW_SPACING_MS = 17 * 3_600_000;

/**
 * Reviews on 20 products, 2–4 each, one per shopper per product. Dates are unique and go back in
 * rounds: every product's first review, then every second review… so the newest reviews are
 * spread across products and shoppers.
 */
export const reviews: Review[] = (() => {
  const reviewed = seeds.flatMap((seed, i) => {
    const product = products[i];
    return product && seed.reviews ? [{ seed, product, list: seed.reviews }] : [];
  });
  const rounds = Math.max(...reviewed.map((r) => r.list.length));
  const out: Review[] = [];
  for (let round = 0; round < rounds; round++) {
    for (const { seed, product, list } of reviewed) {
      const r = list[round];
      if (!r) continue;
      out.push({
        id: `rev-${product.id}-${round + 1}`,
        productId: product.id,
        authorName: REVIEW_AUTHORS[r.by] ?? REVIEW_AUTHORS[0],
        rating: r.rating,
        title: r.title,
        body: r.body,
        photos: r.photo ? [{ url: `/placeholders/${seed.kind}-2.svg`, alt: 'Customer photo' }] : [],
        verifiedPurchase: true,
        createdAt: new Date(NEWEST_REVIEW_AT - out.length * REVIEW_SPACING_MS).toISOString(),
      });
    }
  }
  return out;
})();

// ---------- shipping (shipping_settings + shipping_rates per seller) ----------

const band = (
  zone: DeliveryZone,
  price: number,
  daysMin: number,
  daysMax: number,
  weight: { min: number; max: number } = { min: 0, max: 1000 },
): ShippingRateBand => ({
  zone,
  minWeightG: weight.min,
  maxWeightG: weight.max,
  price: rupees(price),
  daysMin,
  daysMax,
});

const HEAVY = { min: 1000, max: 5000 };

/**
 * Each seller's delivery setup, by seller id. Rose House and Sahil Beauty Hub have no rate for
 * remote areas (the fee is confirmed at checkout); Rose House takes no cash on delivery.
 */
export const shippingProfiles: Record<string, ShippingProfile> = {
  'sel-glow': {
    handlingDays: 1,
    freeShippingMin: rupees(3000),
    codEnabled: true,
    rates: [
      band('same_city', 150, 1, 2),
      band('same_city', 300, 1, 2, HEAVY),
      band('province', 200, 2, 3),
      band('nationwide', 250, 3, 5),
      band('remote', 450, 5, 8),
    ],
  },
  'sel-beautypoint': {
    handlingDays: 1,
    freeShippingMin: rupees(5000),
    codEnabled: true,
    rates: [
      band('same_city', 150, 1, 1),
      band('province', 220, 2, 3),
      band('nationwide', 280, 3, 5),
      band('nationwide', 450, 3, 5, HEAVY),
      band('remote', 500, 6, 9),
    ],
  },
  'sel-rosehouse': {
    handlingDays: 2,
    freeShippingMin: rupees(7500),
    codEnabled: false,
    rates: [
      band('same_city', 200, 1, 2),
      band('province', 250, 2, 3),
      band('nationwide', 300, 3, 5),
    ],
  },
  'sel-skinlab': {
    handlingDays: 1,
    freeShippingMin: rupees(3500),
    codEnabled: true,
    rates: [
      band('same_city', 120, 1, 1),
      band('province', 200, 2, 3),
      band('nationwide', 250, 3, 4),
      band('remote', 400, 5, 7),
    ],
  },
  'sel-velvet': {
    handlingDays: 2,
    freeShippingMin: null,
    codEnabled: true,
    rates: [
      band('same_city', 150, 1, 2),
      band('province', 200, 2, 4),
      band('nationwide', 280, 3, 5),
      band('remote', 480, 6, 8),
    ],
  },
  'sel-gulposh': {
    handlingDays: 1,
    freeShippingMin: rupees(2500),
    codEnabled: true,
    rates: [
      band('same_city', 100, 1, 1),
      band('province', 180, 2, 3),
      band('nationwide', 260, 3, 5),
      band('remote', 420, 4, 7),
    ],
  },
  'sel-chandni': {
    handlingDays: 1,
    freeShippingMin: rupees(2000),
    codEnabled: true,
    rates: [
      band('same_city', 120, 1, 1),
      band('province', 200, 2, 3),
      band('nationwide', 250, 3, 5),
      band('remote', 450, 5, 8),
    ],
  },
  'sel-sahil': {
    handlingDays: 2,
    freeShippingMin: rupees(4000),
    codEnabled: true,
    rates: [
      band('same_city', 220, 1, 2, { min: 500, max: 2000 }),
      band('same_city', 150, 1, 1, { min: 0, max: 500 }),
      band('province', 200, 2, 3, { min: 0, max: 500 }),
      band('nationwide', 280, 3, 5, { min: 0, max: 500 }),
      band('nationwide', 380, 3, 6, { min: 500, max: 2000 }),
    ],
  },
};

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
export const sponsoredProductSlugs = [
  'rose-dusk-palette',
  'vitamin-c-glow-serum',
  'sheen-niacinamide-serum',
];

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

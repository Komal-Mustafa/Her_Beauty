import { describe, expect, it } from 'vitest';
import {
  Brand,
  Category,
  isOnSale,
  PkCity,
  Product,
  Review,
  shadeFamily,
  ShippingProfile,
  Store,
  type ShadeFamily,
} from '@hb/types';
import {
  brands,
  categories,
  heroScenes,
  products,
  REVIEW_AUTHORS,
  reviews,
  servedAds,
  SHADES,
  shippingProfiles,
  sponsoredProductSlugs,
  stores,
} from './fixtures';

/** The first 16 slugs, in id order: ads, the hero and tests refer to them. */
const ORIGINAL_SLUGS = [
  'velvet-matte-lipstick',
  'satin-glow-lipstick',
  'silk-lip-oil',
  'peony-blush-compact',
  'soft-focus-powder',
  'lumiere-highlighter',
  'rose-dusk-palette',
  'gilded-eyes-palette',
  'vitamin-c-glow-serum',
  'hyaluronic-dew-serum',
  'rose-water-cream',
  'damask-rose-eau-de-parfum',
  'oud-blush-parfum',
  'saffron-body-butter',
  'argan-hair-elixir',
  'gold-kabuki-brush',
];

/** The family a person would name each catalogue shade by (docs/p5-catalog.md §4.3). */
const SHADE_FAMILIES: Record<keyof typeof SHADES, ShadeFamily> = {
  berryKiss: 'berry',
  rosePetal: 'pink',
  nudeSilk: 'nude',
  coralBloom: 'coral',
  classicRed: 'red',
  cocoa: 'brown',
  candy: 'pink',
  plum: 'berry',
  softTaupe: 'nude',
  toffee: 'brown',
  rosewood: 'mauve',
  crimson: 'red',
  blackCherry: 'berry',
  biscuit: 'nude',
  caramelNude: 'nude',
  bubblegum: 'pink',
  chilli: 'red',
  papaya: 'coral',
  dustyMauve: 'mauve',
  espresso: 'brown',
  peony: 'pink',
  peach: 'coral',
  sheerNude: 'nude',
  berryFlush: 'berry',
  apricot: 'coral',
  mauve: 'mauve',
  sunsetCoral: 'coral',
  cinnamon: 'brown',
  porcelain: 'nude',
  ivory: 'nude',
  sand: 'nude',
  honey: 'nude',
  caramel: 'nude',
  mocha: 'brown',
  gold: 'gold',
  champagne: 'gold',
  roseGold: 'gold',
  chestnut: 'brown',
};

describe('catalogue fixtures', () => {
  it('match the shared schemas', () => {
    expect(() => Product.array().parse(products)).not.toThrow();
    expect(() => Store.array().parse(stores)).not.toThrow();
    expect(() => Brand.array().parse(brands)).not.toThrow();
    expect(() => Category.array().parse(categories)).not.toThrow();
    expect(() => Review.array().parse(reviews)).not.toThrow();
  });

  it('has 48 products, 6 per category, keeping the original 16 slugs and ids', () => {
    expect(products).toHaveLength(48);
    expect(products.map((p) => p.id)).toEqual(products.map((_, i) => `prd-${i + 1}`));
    expect(products.slice(0, 16).map((p) => p.slug)).toEqual(ORIGINAL_SLUGS);
    expect(new Set(products.map((p) => p.slug)).size).toBe(48);
    for (const c of categories) {
      expect(
        products.filter((p) => p.categoryId === c.id),
        c.slug,
      ).toHaveLength(6);
    }
  });

  it('has 8 sellers and 12 brands, and every product points at them', () => {
    expect(stores).toHaveLength(8);
    expect(brands).toHaveLength(12);
    expect(stores.filter((s) => s.type === 'vendor')).toHaveLength(5);
    for (const p of products) {
      const store = stores.find((s) => s.id === p.seller.id);
      expect(store?.storeName, p.slug).toBe(p.seller.storeName);
      expect(brands.find((b) => b.id === p.brand.id)?.name, p.slug).toBe(p.brand.name);
    }
    // A manufacturer is an official brand store because it owns a protected brand.
    for (const s of stores) {
      const owns = brands.some((b) => b.ownerSellerId === s.id && b.isProtected);
      expect(s.badge === 'official_brand', s.slug).toBe(s.type === 'manufacturer' && owns);
      expect(PkCity.safeParse(s.city).success, s.city).toBe(true);
    }
  });

  it('computes store product counts and ratings from the products', () => {
    for (const s of stores) {
      const own = products.filter((p) => p.seller.id === s.id);
      expect(s.productCount).toBe(own.length);
      expect(s.rating).toBeGreaterThanOrEqual(Math.min(...own.map((p) => p.rating)));
      expect(s.rating).toBeLessThanOrEqual(Math.max(...own.map((p) => p.rating)));
    }
  });

  it('prices in integer paisa between Rs 650 and Rs 12,000, cheapest variant first', () => {
    for (const p of products) {
      const prices = p.variants.map((v) => v.price);
      expect(prices.every((x) => Number.isInteger(x) && x >= 65_000 && x <= 1_200_000)).toBe(true);
      expect(prices).toEqual([...prices].sort((a, b) => a - b));
      expect(p.price).toBe(prices[0]);
    }
  });

  it('mixes sales, new arrivals and stock like a real shop', () => {
    const onSale = products.filter(isOnSale).length;
    const fresh = products.filter((p) => p.isNew).length;
    expect(onSale).toBeGreaterThanOrEqual(14);
    expect(onSale).toBeLessThanOrEqual(18);
    expect(fresh).toBeGreaterThanOrEqual(10);
    expect(fresh).toBeLessThanOrEqual(14);
    const soldOut = products.filter((p) => p.variants.every((v) => v.stock === 0));
    expect(soldOut.map((p) => p.slug)).toHaveLength(2);
    expect(soldOut.every((p) => p.quickAddVariantId === null)).toBe(true);
    const soldOutShades = products.flatMap((p) =>
      p.variants.length > 1 ? p.variants.filter((v) => v.stock === 0) : [],
    );
    expect(soldOutShades.length).toBeGreaterThanOrEqual(3);
    // Size variants exist, for the size pills on the product page.
    expect(products.some((p) => p.variants.length > 1 && p.variants[0]?.shadeName === null)).toBe(
      true,
    );
  });

  it('gives lipsticks and blushes 4–8 shades and has a gold highlighter', () => {
    const shaded = products.filter((p) => /lipstick|blush (compact|stick)/i.test(p.title));
    expect(shaded.length).toBeGreaterThanOrEqual(4);
    for (const p of shaded) {
      expect(p.shades.length, p.slug).toBeGreaterThanOrEqual(4);
      expect(p.shades.length, p.slug).toBeLessThanOrEqual(8);
    }
    const highlighter = products.find((p) => p.slug === 'lumiere-highlighter');
    expect(highlighter?.shades.map((s) => shadeFamily(s.hex))).toContain('gold');
    const families = new Set(products.flatMap((p) => p.shades.map((s) => shadeFamily(s.hex))));
    expect(families.size).toBe(8);
  });

  it('pins every shade to the family a person would name', () => {
    for (const [key, family] of Object.entries(SHADE_FAMILIES)) {
      const shade = SHADES[key as keyof typeof SHADES];
      expect(shadeFamily(shade.hex), shade.name).toBe(family);
    }
    const known = new Set(Object.values(SHADES).map((s) => `${s.name}|${s.hex}`));
    for (const p of products) {
      for (const s of p.shades) expect(known.has(`${s.name}|${s.hex}`), s.name).toBe(true);
    }
  });

  it('describes every product with sanitizer-safe HTML, how to use and ingredients', () => {
    for (const p of products) {
      expect(p.descriptionHtml, p.slug).toMatch(/^<p>[^<>]+<\/p><ul>(<li>[^<>]+<\/li>){3}<\/ul>$/);
      expect(p.howToUse?.length ?? 0, p.slug).toBeGreaterThan(20);
      expect(p.ingredients?.length ?? 0, p.slug).toBeGreaterThan(10);
      expect(p.tags.length, p.slug).toBeGreaterThanOrEqual(3);
    }
    const skinCategories = ['cat-skincare', 'cat-face', 'cat-body'];
    const withSkin = products.filter((p) => skinCategories.includes(p.categoryId));
    expect(withSkin.filter((p) => p.skinTypes.length > 0).length).toBeGreaterThanOrEqual(14);
  });

  it('keeps 3D only for kinds with a procedural model, and media consistent with flags', () => {
    for (const p of products) {
      const model = p.media.find((m) => m.type === 'model3d');
      expect(Boolean(model), p.slug).toBe(p.has3d);
      if (model) expect(model.model3dKind, p.slug).not.toBeNull();
      expect(
        p.media.some((m) => m.type === 'video'),
        p.slug,
      ).toBe(p.hasVideo);
      const images = p.media.filter((m) => m.type === 'image');
      expect(images.map((m) => [m.url, m.alt])).toEqual(p.images.map((i) => [i.url, i.alt]));
    }
  });

  it('reviews about 20 products, 2–4 each, one per shopper, 3–5 stars', () => {
    const byProduct = new Map<string, Review[]>();
    for (const r of reviews) byProduct.set(r.productId, [...(byProduct.get(r.productId) ?? []), r]);
    expect(byProduct.size).toBe(20);
    for (const [productId, list] of byProduct) {
      expect(list.length, productId).toBeGreaterThanOrEqual(2);
      expect(list.length, productId).toBeLessThanOrEqual(4);
      const authors = list.map((r) => r.authorName);
      expect(new Set(authors).size, productId).toBe(authors.length);
    }
    expect(reviews.every((r) => r.rating >= 3 && r.rating <= 5)).toBe(true);
    expect(reviews.every((r) => (REVIEW_AUTHORS as readonly string[]).includes(r.authorName))).toBe(
      true,
    );
    expect(reviews.filter((r) => r.photos.length > 0).length).toBeGreaterThanOrEqual(3);
    // Unique timestamps: featured reviews never tie on date.
    expect(new Set(reviews.map((r) => r.createdAt)).size).toBe(reviews.length);
    expect(reviews.every((r) => r.createdAt < '2026-09-29')).toBe(true);
  });

  it('keeps every ad, hero and sponsored reference valid', () => {
    const slugs = new Set(products.map((p) => p.slug));
    for (const ad of servedAds) {
      expect(slugs.has(ad.productSlug ?? ''), ad.id).toBe(true);
      expect(ad.href).toBe(`/product/${ad.productSlug}`);
      const store = stores.find((s) => s.storeName === ad.sellerName);
      const product = products.find((p) => p.slug === ad.productSlug);
      expect(product?.seller.id, ad.id).toBe(store?.id);
    }
    for (const slug of sponsoredProductSlugs) {
      const product = products.find((p) => p.slug === slug);
      expect(product, slug).toBeDefined();
      // The seed books sponsored products on a campaign of the same seller.
      const advertiser = servedAds.some(
        (a) => stores.find((s) => s.storeName === a.sellerName)?.id === product?.seller.id,
      );
      expect(advertiser, slug).toBe(true);
    }
    expect(heroScenes.every((h) => h.ad === null || slugs.has(h.ad.productSlug ?? ''))).toBe(true);
  });

  it('has a shipping profile for every seller', () => {
    for (const s of stores) {
      const profile = ShippingProfile.parse(shippingProfiles[s.id]);
      expect(profile.handlingDays, s.slug).toBeGreaterThanOrEqual(1);
      expect(profile.handlingDays, s.slug).toBeLessThanOrEqual(2);
      expect(
        profile.rates.some((r) => r.zone === 'nationwide'),
        s.slug,
      ).toBe(true);
      for (const r of profile.rates) expect(r.maxWeightG).toBeGreaterThan(r.minWeightG);
    }
    expect(Object.keys(shippingProfiles).sort()).toEqual(stores.map((s) => s.id).sort());
  });
});

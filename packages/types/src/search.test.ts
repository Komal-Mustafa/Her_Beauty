import { describe, expect, it } from 'vitest';
import { Product, ProductCard, SearchResult, ShadeFamily, type ProductSort } from './catalog';
import {
  allowedTypos,
  computeFacets,
  damerauLevenshtein,
  discountPercent,
  filterProducts,
  isOnSale,
  normalizeText,
  pinSponsored,
  runSearch,
  searchDoc,
  searchScore,
  selectProducts,
  shadeFamily,
  SHADE_FAMILY_HEX,
  SHADE_FAMILY_LABEL,
  sortProducts,
  toProductCard,
  type SearchContext,
  type SearchDoc,
} from './search';

const ctx: SearchContext = {
  categories: [
    { id: 'c-lips', slug: 'lips', name: 'Lips' },
    { id: 'c-face', slug: 'face', name: 'Face' },
    { id: 'c-skin', slug: 'skincare', name: 'Skincare' },
  ],
};

let seq = 0;

/** A valid Product; the fields a test cares about go in `over`. */
function product(
  over: Partial<Product> & { brandSlug?: string; brandName?: string } = {},
): Product {
  seq += 1;
  const { brandSlug = 'glow', brandName = 'Glow', ...rest } = over;
  const price = rest.price ?? 100_000;
  const p: Product = {
    id: `p${seq}`,
    slug: `product-${seq}`,
    title: `Product ${seq}`,
    brand: { id: `b-${brandSlug}`, slug: brandSlug, name: brandName },
    seller: {
      id: 's-1',
      slug: 'glow-cosmetics',
      storeName: 'Glow Cosmetics',
      type: 'manufacturer',
      badge: 'official_brand',
    },
    categoryId: 'c-lips',
    images: [{ url: '/placeholders/lipstick-1.svg', alt: 'x' }],
    price,
    compareAtPrice: null,
    currency: 'PKR',
    shades: [],
    rating: 4,
    ratingCount: 10,
    has3d: false,
    hasVideo: false,
    isNew: false,
    sponsored: false,
    quickAddVariantId: null,
    descriptionHtml: '<p>x</p>',
    howToUse: null,
    ingredients: null,
    skinTypes: [],
    tags: [],
    variants: [
      {
        id: `v${seq}`,
        sku: `SKU-${seq}`,
        shadeName: null,
        shadeHex: null,
        sizeLabel: null,
        price,
        compareAtPrice: null,
        currency: 'PKR',
        stock: 5,
      },
    ],
    media: [],
    soldCount: 0,
    ...rest,
  };
  return Product.parse(p);
}

const slugs = (list: readonly { slug: string }[]) => list.map((p) => p.slug);

describe('normalizeText', () => {
  it('lowercases, strips accents and symbols, spells out &', () => {
    expect(normalizeText('Lumière Gold')).toBe('lumiere gold');
    expect(normalizeText('Saffron & Co')).toBe('saffron and co');
    expect(normalizeText('  Rose--Dusk!!  Palette ')).toBe('rose dusk palette');
    expect(normalizeText('SPF-50 (Invisible)')).toBe('spf 50 invisible');
    expect(normalizeText('Crème brûlée')).toBe('creme brulee');
  });

  it('keeps letters of other scripts and gives an empty string for symbols only', () => {
    expect(normalizeText('سرمہ kohl')).toBe('سرمہ kohl');
    expect(normalizeText(' !!! ')).toBe('');
  });
});

describe('damerauLevenshtein', () => {
  it('counts inserts, deletes, substitutions and neighbour swaps', () => {
    expect(damerauLevenshtein('lipstik', 'lipstick')).toBe(1);
    expect(damerauLevenshtein('lipstick', 'lipstik')).toBe(1);
    expect(damerauLevenshtein('serum', 'sreum')).toBe(1);
    expect(damerauLevenshtein('mascara', 'mascaro')).toBe(1);
    expect(damerauLevenshtein('kitten', 'sitting')).toBe(3);
    expect(damerauLevenshtein('', 'abc')).toBe(3);
    expect(damerauLevenshtein('same', 'same')).toBe(0);
  });

  it('stops early above the bound', () => {
    expect(damerauLevenshtein('kitten', 'sitting', 1)).toBe(2);
    expect(damerauLevenshtein('a', 'abcdef', 2)).toBe(3);
  });

  it('allows no typo under 4 letters, 1 for 4–7, 2 from 8', () => {
    expect([1, 3, 4, 7, 8, 12].map(allowedTypos)).toEqual([0, 0, 1, 1, 2, 2]);
  });
});

describe('searchScore', () => {
  const doc = (over: Partial<SearchDoc>): SearchDoc => ({
    title: '',
    brand: '',
    store: '',
    category: '',
    tags: [],
    shades: [],
    ...over,
  });
  const lipstick = doc({
    title: 'Velvet Matte Lipstick',
    brand: 'Glow',
    store: 'Glow Cosmetics',
    category: 'Lips',
    tags: ['lipstick', 'long-wear'],
    shades: ['Berry Kiss', 'Nude Silk'],
  });

  it('finds "lipstik" with a typo', () => {
    expect(searchScore('lipstik', lipstick)).toBeGreaterThan(0);
    expect(searchScore('LIPSTIK', lipstick)).toBe(searchScore('lipstik', lipstick));
  });

  it('matches accents either way', () => {
    const lumiere = doc({ title: 'Gold Highlighter', brand: 'Lumière' });
    expect(searchScore('lumiere', lumiere)).toBeGreaterThan(0);
    expect(searchScore('Lumière', lumiere)).toBe(searchScore('lumiere', lumiere));
  });

  it('needs every word (AND)', () => {
    const serum = doc({ title: 'Vitamin C Glow Serum', tags: ['vitamin c', 'serum'] });
    const cream = doc({ title: 'Vitamin E Body Cream' });
    expect(searchScore('vitamin serum', serum)).toBeGreaterThan(0);
    expect(searchScore('vitamin serum', cream)).toBe(0);
    expect(searchScore('xyzzy', lipstick)).toBe(0);
    expect(searchScore('', lipstick)).toBe(0);
    expect(searchScore('  !! ', lipstick)).toBe(0);
  });

  it('ranks exact above prefix above typo, and weighs fields', () => {
    const exact = searchScore('matte', lipstick);
    const prefix = searchScore('mat', lipstick);
    const typo = searchScore('matt', doc({ title: 'Mate' }));
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(typo);
    // title 4 > brand 3 > category/tags 2 > shades/store 1
    const inTitle = searchScore('rose', doc({ title: 'Rose' }));
    const inBrand = searchScore('rose', doc({ brand: 'Rose' }));
    const inTags = searchScore('rose', doc({ tags: ['rose'] }));
    const inCategory = searchScore('rose', doc({ category: 'Rose' }));
    const inShade = searchScore('rose', doc({ shades: ['Rose'] }));
    const inStore = searchScore('rose', doc({ store: 'Rose' }));
    expect([inTitle, inBrand, inTags, inCategory, inShade, inStore]).toEqual([12, 9, 6, 6, 3, 3]);
  });

  it('takes the best field per word and adds the words up', () => {
    // "velvet" in the title (12) beats the brand (9); "matte" adds another 12.
    const score = searchScore('velvet matte', doc({ title: 'Velvet Matte', brand: 'Velvet' }));
    expect(score).toBe(24);
  });

  it('matches by prefix only for the last word, from 2 letters', () => {
    expect(searchScore('velvet lip', lipstick)).toBeGreaterThan(0);
    expect(searchScore('lip velvet', lipstick)).toBe(0);
    expect(searchScore('l', lipstick)).toBe(0);
    expect(searchScore('li', lipstick)).toBeGreaterThan(0);
  });

  it('allows no typos in words under 4 letters and at most the allowed number', () => {
    expect(searchScore('lps', doc({ title: 'Lips' }))).toBe(0);
    expect(searchScore('lipz', doc({ title: 'Lips' }))).toBeGreaterThan(0);
    expect(searchScore('lipstck', lipstick)).toBeGreaterThan(0); // 7 letters: 1 typo
    expect(searchScore('lpstik', lipstick)).toBe(0); // 6 letters, 2 typos
    expect(searchScore('highlihgter', doc({ title: 'Highlighter' }))).toBeGreaterThan(0);
    expect(searchScore('hghlihgter', doc({ title: 'Highlighter' }))).toBeGreaterThan(0);
    expect(searchScore('hghlihgtr', doc({ title: 'Highlighter' }))).toBe(0); // 3 typos
  });
});

describe('typos as a fallback', () => {
  const tools: SearchContext = {
    categories: [...ctx.categories, { id: 'c-tools', slug: 'tools', name: 'Tools' }],
  };
  const blush = product({ title: 'Peony Blush Compact', categoryId: 'c-face' });
  const creamBlush = product({ title: 'Cream Blush Stick', categoryId: 'c-face' });
  const kabuki = product({ title: 'Gold Kabuki Brush', categoryId: 'c-tools' });
  const fan = product({ title: 'Highlighter Fan Brush', categoryId: 'c-tools' });
  const lipstick = product({ title: 'Velvet Matte Lipstick' });
  const all = [blush, creamBlush, kabuki, fan, lipstick];
  const find = (q: string, list: readonly Product[] = all) =>
    slugs(filterProducts(list, { q }, tools));

  it('never gives a word that some product has a second meaning', () => {
    expect(find('blush')).toEqual(slugs([blush, creamBlush]));
    expect(find('brush')).toEqual(slugs([kabuki, fan]));
    expect(find('BLUSH')).toEqual(find('blush'));
  });

  it('still rescues a misspelt word that no product has', () => {
    expect(find('lipstik')).toEqual([lipstick.slug]);
    expect(find('blushs')).toEqual(slugs([blush, creamBlush]));
    // Without any blush in the scanned products, "blush" is read as a typo of "brush".
    expect(find('blush', [kabuki, fan, lipstick])).toEqual(slugs([kabuki, fan]));
  });

  it('counts a prefix of the last word as a match without typos', () => {
    const kajal = product({ title: 'Blue Kajal', categoryId: 'c-face' });
    // "blus" starts "blush", so it is not also read as a typo of "blue".
    expect(find('blus', [...all, kajal])).toEqual(slugs([blush, creamBlush]));
    // An earlier word is no prefix: no product has "kabuk", so it may be "kabuki" with a typo.
    expect(find('kabuk gold')).toEqual([kabuki.slug]);
  });

  it('decides per word', () => {
    // "gold" is exact, "brsh" (4 letters, no product has it) may have one typo.
    expect(find('gold brsh')).toEqual([kabuki.slug]);
    // Both words exist, so neither is read as a typo, and no product has both.
    expect(find('blush brush')).toEqual([]);
  });

  it('judges search against every scanned product and getProducts against its other filters', () => {
    // Search: blushes exist, so "blush" in Tools finds nothing (and facets do not shift).
    expect(slugs(filterProducts(all, { q: 'blush', category: 'tools' }, tools))).toEqual([]);
    const facets = computeFacets(all, { q: 'blush', category: 'tools' }, tools);
    expect(facets.categories.map((c) => [c.value, c.count])).toEqual([
      ['lips', 0],
      ['face', 2],
      ['skincare', 0],
      ['tools', 0],
    ]);
    expect(runSearch(all, { q: 'blush', category: 'tools' }, tools).total).toBe(0);
    // getProducts: the API loads only the Tools rows, so the mock judges the same rows.
    expect(slugs(selectProducts(all, { q: 'blush', category: 'tools' }, tools))).toEqual(
      slugs([kabuki, fan]),
    );
    expect(slugs(selectProducts(all, { q: 'blush' }, tools))).toEqual(slugs([blush, creamBlush]));
  });

  it('scores a single document by the same rule', () => {
    const doc: SearchDoc = {
      title: 'Kabuki Brush',
      brand: '',
      store: '',
      category: '',
      tags: ['blush'],
      shades: [],
    };
    // "blush" is in the tags, so the title's "brush" (a typo away) does not count.
    expect(searchScore('blush', doc)).toBe(6);
    expect(searchScore('blush', { ...doc, tags: [] })).toBe(4);
  });
});

describe('shade families in text search', () => {
  const chilli = { name: 'Chilli', hex: '#9E1B1B' };
  const berry = { name: 'Berry Kiss', hex: '#8E1B4F' };
  const nude = { name: 'Nude Silk', hex: '#C98A7A' };
  const redLipstick = product({ title: 'Liquid Matte Lipstick', shades: [chilli, nude] });
  const berryLipstick = product({ title: 'Satin Glow Lipstick', shades: [berry, nude] });
  const redBlush = product({ title: 'Cream Blush Stick', categoryId: 'c-face', shades: [chilli] });
  const all = [redLipstick, berryLipstick, redBlush];

  it('lists each family label once, beside the shade names', () => {
    expect(searchDoc(redLipstick, ctx).shades).toEqual(['Chilli', 'Nude Silk']);
    expect(searchDoc(redLipstick, ctx).shadeFamilies).toEqual(['Red', 'Nude']);
    expect(
      searchDoc(product({ shades: [chilli, { name: 'Crimson', hex: '#B3122E' }] }), ctx)
        .shadeFamilies,
    ).toEqual(['Red']);
    expect(searchDoc(product(), ctx).shadeFamilies).toEqual([]);
  });

  it('finds a product by a family none of its shade names spells', () => {
    expect(slugs(filterProducts(all, { q: 'red lipstick' }, ctx))).toEqual([redLipstick.slug]);
    expect(slugs(filterProducts(all, { q: 'red' }, ctx))).toEqual(slugs([redLipstick, redBlush]));
    expect(slugs(filterProducts(all, { q: 'berry' }, ctx))).toEqual([berryLipstick.slug]);
  });

  it('weighs a family label like a shade name', () => {
    const doc = searchDoc(redLipstick, ctx);
    expect(searchScore('red', doc)).toBe(3);
    expect(searchScore('chilli', doc)).toBe(3);
    // Title words still rank first: "lipstick" (12) + "red" (3).
    expect(searchScore('red lipstick', doc)).toBe(15);
  });

  it('matches a family only by the whole word, never by prefix or with a typo', () => {
    const cocoa = { name: 'Cocoa', hex: '#7B4A3A' };
    const bare = { name: 'Bare', hex: '#C98A7A' };
    const plum = { name: 'Plum Wine', hex: '#8E1B4F' };
    expect([cocoa, bare, plum].map((s) => shadeFamily(s.hex))).toEqual(['brown', 'nude', 'berry']);
    const brownLipstick = product({ title: 'Liquid Matte Lipstick', shades: [cocoa, bare] });
    const plumLipstick = product({ title: 'Satin Lipstick', shades: [plum] });
    const pomade = product({
      title: 'Brow Pomade',
      categoryId: 'c-face',
      shades: [{ name: 'Taupe', hex: '#8A7466' }],
    });
    const list = [brownLipstick, plumLipstick, pomade];
    const find = (q: string) => slugs(filterProducts(list, { q }, ctx));
    // "brow" is a word being typed: it may start "Brow…", not the hidden family "Brown".
    expect(find('brow')).toEqual([pomade.slug]);
    expect(find('bro')).toEqual([pomade.slug]);
    expect(find('matte brow')).toEqual([]);
    expect(find('brown')).toEqual([brownLipstick.slug, pomade.slug]); // Taupe is brown too
    expect(find('nu')).toEqual([]);
    expect(find('nude')).toEqual([brownLipstick.slug]);
    // No product has "berri", yet it is no typo of the family "Berry" (a shade name would be).
    expect(find('berri')).toEqual([]);
    expect(find('berry')).toEqual([plumLipstick.slug]);
    const doc = searchDoc(brownLipstick, ctx);
    expect(searchScore('brow', doc)).toBe(0);
    expect(searchScore('brown', doc)).toBe(3);
  });
});

describe('shadeFamily', () => {
  it('names shades the way a person would', () => {
    const pinned: [string, string, ShadeFamily][] = [
      ['Berry Kiss', '#8E1B4F', 'berry'],
      ['Plum', '#6B1F3F', 'berry'],
      ['Nude Silk', '#C98A7A', 'nude'],
      ['Biscuit', '#D1A38A', 'nude'],
      ['Porcelain', '#F4DDCB', 'nude'],
      ['Rose Petal', '#C2185B', 'pink'],
      ['Peony', '#F4A6C0', 'pink'],
      ['Classic Red', '#B3122E', 'red'],
      ['Chilli', '#9E1B1B', 'red'],
      ['Coral Bloom', '#E5675C', 'coral'],
      ['Apricot', '#F2A07B', 'coral'],
      ['Mauve', '#B8738C', 'mauve'],
      ['Dusty Mauve', '#A86F83', 'mauve'],
      ['Cocoa', '#7B4A3A', 'brown'],
      ['Chestnut', '#8B4A2B', 'brown'],
      ['Gold highlighter', '#D4AF37', 'gold'],
      ['Champagne', '#E8C98F', 'gold'],
    ];
    for (const [name, hex, family] of pinned) expect(shadeFamily(hex), name).toBe(family);
  });

  it('files greys, black and white, and is case-insensitive', () => {
    expect(shadeFamily('#111111')).toBe('brown');
    expect(shadeFamily('#808080')).toBe('brown');
    expect(shadeFamily('#FFFFFF')).toBe('nude');
    expect(shadeFamily('#8e1b4f')).toBe('berry');
  });

  it('draws each family with a swatch that belongs to it, in enum order', () => {
    expect(Object.keys(SHADE_FAMILY_HEX)).toEqual(ShadeFamily.options);
    expect(Object.keys(SHADE_FAMILY_LABEL)).toEqual(ShadeFamily.options);
    for (const family of ShadeFamily.options) {
      expect(shadeFamily(SHADE_FAMILY_HEX[family])).toBe(family);
      expect(SHADE_FAMILY_HEX[family]).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});

describe('discountPercent', () => {
  it('rounds the percent down to a whole number', () => {
    expect(discountPercent(185_000, 220_000)).toBe(15); // 15.9 %
    expect(discountPercent(225_000, 300_000)).toBe(25);
    expect(discountPercent(1, 3)).toBe(66);
  });

  it('is 0 without a higher compare-at price', () => {
    expect(discountPercent(1000, null)).toBe(0);
    expect(discountPercent(1000, 1000)).toBe(0);
    expect(discountPercent(1000, 900)).toBe(0);
    expect(isOnSale({ price: 1000, compareAtPrice: 1000 })).toBe(false);
    expect(isOnSale({ price: 900, compareAtPrice: 1000 })).toBe(true);
  });
});

describe('filterProducts', () => {
  const red = { name: 'Classic Red', hex: '#B3122E' };
  const nude = { name: 'Nude Silk', hex: '#C98A7A' };
  const a = product({
    title: 'Velvet Matte Lipstick',
    shades: [red, nude],
    price: 185_000,
    compareAtPrice: 220_000,
    rating: 4.8,
    isNew: true,
  });
  const b = product({
    title: 'Hydrating Serum',
    categoryId: 'c-skin',
    brandSlug: 'dewy',
    brandName: 'Dewy',
    seller: {
      id: 's-2',
      slug: 'skin-lab',
      storeName: 'Skin Lab PK',
      type: 'vendor',
      badge: 'verified_seller',
    },
    skinTypes: ['dry', 'sensitive'],
    price: 265_000,
    rating: 3.5,
  });
  const c = product({
    title: 'Peony Blush',
    categoryId: 'c-face',
    brandSlug: 'velvet',
    brandName: 'Velvet',
    shades: [{ name: 'Peony', hex: '#F4A6C0' }],
    skinTypes: ['oily'],
    price: 240_000,
    rating: 4.9,
  });
  const all = [a, b, c];
  const filter = (q: Parameters<typeof filterProducts>[1]) => slugs(filterProducts(all, q, ctx));

  it('applies each filter', () => {
    expect(filter({})).toEqual(slugs(all));
    expect(filter({ category: 'skincare' })).toEqual([b.slug]);
    expect(filter({ category: 'unknown' })).toEqual([]);
    expect(filter({ brand: ['dewy', 'velvet'] })).toEqual([b.slug, c.slug]);
    expect(filter({ brand: [] })).toEqual(slugs(all));
    expect(filter({ seller: 'skin-lab' })).toEqual([b.slug]);
    expect(filter({ sellerType: 'manufacturer' })).toEqual([a.slug, c.slug]);
    expect(filter({ skinType: ['sensitive', 'oily'] })).toEqual([b.slug, c.slug]);
    expect(filter({ shade: ['red'] })).toEqual([a.slug]);
    expect(filter({ shade: ['nude', 'pink'] })).toEqual([a.slug, c.slug]);
    expect(filter({ minPrice: 240_000 })).toEqual([b.slug, c.slug]);
    expect(filter({ maxPrice: 240_000 })).toEqual([a.slug, c.slug]);
    expect(filter({ minPrice: 200_000, maxPrice: 250_000 })).toEqual([c.slug]);
    expect(filter({ minRating: 4 })).toEqual([a.slug, c.slug]);
    expect(filter({ onSale: true })).toEqual([a.slug]);
    expect(filter({ onSale: false })).toEqual([b.slug, c.slug]);
    expect(filter({ isNew: true })).toEqual([a.slug]);
    expect(filter({ isNew: false })).toEqual([b.slug, c.slug]);
    expect(filter({ ids: [c.id, 'unknown', a.id] })).toEqual([a.slug, c.slug]);
  });

  it('matches text against title, brand, store, category, tags and shades', () => {
    expect(filter({ q: 'lipstik' })).toEqual([a.slug]);
    expect(filter({ q: 'skincare' })).toEqual([b.slug]); // category name
    expect(filter({ q: 'skin lab' })).toEqual([b.slug]); // store
    expect(filter({ q: 'classic red' })).toEqual([a.slug]); // shade
    expect(filter({ q: 'velvet' })).toEqual([a.slug, c.slug]);
    expect(filter({ q: '   ' })).toEqual(slugs(all));
  });

  it('combines filters with AND', () => {
    expect(filter({ q: 'velvet', category: 'face' })).toEqual([c.slug]);
    expect(filter({ sellerType: 'manufacturer', onSale: true, shade: ['red'] })).toEqual([a.slug]);
  });
});

describe('sortProducts', () => {
  const p1 = product({ price: 300_000, rating: 4.5, ratingCount: 10, soldCount: 5, isNew: false });
  const p2 = product({
    price: 100_000,
    compareAtPrice: 200_000,
    rating: 4.5,
    ratingCount: 50,
    soldCount: 50,
    isNew: true,
  });
  const p3 = product({
    price: 200_000,
    compareAtPrice: 250_000,
    rating: 4.9,
    ratingCount: 2,
    soldCount: 50,
    isNew: false,
  });
  const p4 = product({
    price: 50_000,
    compareAtPrice: 100_000,
    rating: 3,
    soldCount: 1,
    isNew: true,
  });
  const list = [p1, p2, p3, p4];
  const order = (sort: ProductSort | undefined, scores?: Map<string, number>) =>
    sortProducts(list, sort, scores).map((p) => list.indexOf(p) + 1);

  it('orders by each sort, keeping input order on ties', () => {
    expect(order(undefined)).toEqual([1, 2, 3, 4]);
    expect(order('newest')).toEqual([2, 4, 1, 3]);
    expect(order('price_asc')).toEqual([4, 2, 3, 1]);
    expect(order('price_desc')).toEqual([1, 3, 2, 4]);
    expect(order('rating')).toEqual([3, 2, 1, 4]);
    expect(order('best_selling')).toEqual([2, 3, 1, 4]);
    // 50 % (p4, cheaper) before 50 % (p2), then 20 % (p3), then 0 %.
    expect(order('discount')).toEqual([4, 2, 3, 1]);
  });

  it('orders relevance by score, stable, and keeps input order without scores', () => {
    const scores = new Map([
      [p1.id, 5],
      [p2.id, 9],
      [p3.id, 5],
      [p4.id, 1],
    ]);
    expect(order('relevance', scores)).toEqual([2, 1, 3, 4]);
    expect(order('relevance')).toEqual([1, 2, 3, 4]);
  });

  it('does not change the input list', () => {
    const copy = [...list];
    sortProducts(list, 'price_asc');
    expect(list).toEqual(copy);
  });
});

describe('pinSponsored', () => {
  const s = (id: string, sponsored: boolean) => ({ id, sponsored });

  it('moves the first two sponsored products to the front, the rest keep their order', () => {
    const list = [s('a', false), s('b', true), s('c', false), s('d', true), s('e', true)];
    expect(pinSponsored(list).map((x) => x.id)).toEqual(['b', 'd', 'a', 'c', 'e']);
    expect(pinSponsored(list, 1).map((x) => x.id)).toEqual(['b', 'a', 'c', 'd', 'e']);
    expect(pinSponsored(list, 0).map((x) => x.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(pinSponsored([s('a', false)]).map((x) => x.id)).toEqual(['a']);
  });
});

describe('computeFacets', () => {
  const glowLip = product({
    brandSlug: 'glow',
    brandName: 'Glow',
    shades: [{ name: 'Classic Red', hex: '#B3122E' }],
    skinTypes: ['dry'],
    price: 150_000,
    compareAtPrice: 180_000,
    rating: 4.6,
  });
  const glowLip2 = product({
    brandSlug: 'glow',
    brandName: 'Glow',
    shades: [
      { name: 'Nude Silk', hex: '#C98A7A' },
      { name: 'Biscuit', hex: '#D1A38A' },
    ],
    price: 120_000,
    rating: 3.4,
  });
  const dewySerum = product({
    brandSlug: 'dewy',
    brandName: 'Dewy',
    categoryId: 'c-skin',
    skinTypes: ['dry', 'oily'],
    price: 300_000,
    rating: 4.1,
    seller: {
      id: 's-2',
      slug: 'skin-lab',
      storeName: 'Skin Lab PK',
      type: 'vendor',
      badge: 'verified_seller',
    },
  });
  const lumiereLip = product({
    brandSlug: 'lumiere',
    brandName: 'Lumière',
    shades: [{ name: 'Gold', hex: '#D4AF37' }],
    price: 275_000,
    compareAtPrice: 300_000,
    rating: 2.9,
  });
  const all = [glowLip, glowLip2, dewySerum, lumiereLip];
  const counts = (options: { value: string; count: number }[]) =>
    Object.fromEntries(options.map((o) => [o.value, o.count]));

  it('counts every option without filters', () => {
    const f = computeFacets(all, {}, ctx);
    expect(counts(f.categories)).toEqual({ lips: 3, face: 0, skincare: 1 });
    expect(f.categories.map((c) => c.label)).toEqual(['Lips', 'Face', 'Skincare']);
    // Brands sorted by label (accents compare as letters).
    expect(f.brands.map((b) => [b.value, b.label, b.count])).toEqual([
      ['dewy', 'Dewy', 1],
      ['glow', 'Glow', 2],
      ['lumiere', 'Lumière', 1],
    ]);
    expect(f.shades.map((s) => s.value)).toEqual(ShadeFamily.options);
    expect(counts(f.shades)).toMatchObject({ red: 1, nude: 1, gold: 1, pink: 0 });
    expect(f.shades.find((s) => s.value === 'gold')).toEqual({
      value: 'gold',
      label: 'Gold',
      count: 1,
      hex: SHADE_FAMILY_HEX.gold,
    });
    expect(counts(f.skinTypes)).toEqual({
      dry: 2,
      oily: 1,
      combination: 0,
      normal: 0,
      sensitive: 0,
    });
    expect(f.sellerTypes).toEqual([
      { value: 'vendor', label: 'Resellers', count: 1 },
      { value: 'manufacturer', label: 'Official brand stores', count: 3 },
    ]);
    expect(f.ratings).toEqual([
      { value: '4', label: '4 stars & up', count: 2 },
      { value: '3', label: '3 stars & up', count: 3 },
    ]);
    expect(f.onSale).toBe(2);
    expect(f.price).toEqual({ min: 120_000, max: 300_000 });
  });

  it('keeps both brands counted when two are ticked (disjunctive)', () => {
    const f = computeFacets(all, { brand: ['glow', 'dewy'] }, ctx);
    expect(counts(f.brands)).toEqual({ dewy: 1, glow: 2, lumiere: 1 });
    // Other groups count only the ticked brands.
    expect(counts(f.categories)).toEqual({ lips: 2, face: 0, skincare: 1 });
    expect(f.onSale).toBe(1);
  });

  it('counts brands without the brand filter but with every other filter', () => {
    const f = computeFacets(all, { brand: ['glow'], category: 'lips', minRating: 4 }, ctx);
    expect(counts(f.brands)).toEqual({ dewy: 0, glow: 1, lumiere: 0 });
    // Category counts ignore the category filter: the Dewy serum is excluded by its brand.
    expect(counts(f.categories)).toEqual({ lips: 1, face: 0, skincare: 0 });
    // Ratings ignore minRating but respect brand and category.
    expect(counts(f.ratings)).toEqual({ '4': 1, '3': 2 });
  });

  it('gives the price range without the price filter, null when nothing matches', () => {
    const f = computeFacets(all, { minPrice: 200_000, brand: ['glow'] }, ctx);
    expect(f.price).toEqual({ min: 120_000, max: 150_000 });
    expect(computeFacets(all, { q: 'xyzzy' }, ctx).price).toBeNull();
    expect(computeFacets([], {}, ctx).price).toBeNull();
  });

  it('applies text, seller, isNew and ids to every group', () => {
    const f = computeFacets(all, { seller: 'skin-lab' }, ctx);
    expect(counts(f.brands)).toEqual({ dewy: 1, glow: 0, lumiere: 0 });
    expect(counts(f.sellerTypes)).toEqual({ vendor: 1, manufacturer: 0 });
    const g = computeFacets(all, { ids: [glowLip.id] }, ctx);
    expect(counts(g.brands)).toEqual({ dewy: 0, glow: 1, lumiere: 0 });
  });

  it('counts a product once per shade family and skin type', () => {
    const f = computeFacets([glowLip2], {}, ctx);
    expect(counts(f.shades).nude).toBe(1);
  });
});

describe('selectProducts', () => {
  const plain = product({ soldCount: 30 });
  const promoted = product({ soldCount: 10, sponsored: true });
  const promoted2 = product({ soldCount: 5, sponsored: true });
  const promoted3 = product({ soldCount: 1, sponsored: true });
  const top = product({ soldCount: 99 });
  const all = [plain, promoted, promoted2, promoted3, top];

  it('orders best selling by default, sponsored (max 2) first', () => {
    expect(slugs(selectProducts(all, {}, ctx))).toEqual(
      slugs([promoted, promoted2, top, plain, promoted3]),
    );
    expect(slugs(selectProducts(all, { sort: 'relevance' }, ctx))).toEqual(
      slugs([promoted, promoted2, top, plain, promoted3]),
    );
  });

  it('never pins with an explicit sort', () => {
    expect(slugs(selectProducts(all, { sort: 'best_selling' }, ctx))).toEqual(
      slugs([top, plain, promoted, promoted2, promoted3]),
    );
  });

  it('returns ids in the order asked for, skipping unknown ones', () => {
    const ids = [promoted3.id, 'nope', plain.id, promoted3.id];
    expect(slugs(selectProducts(all, { ids }, ctx))).toEqual(slugs([promoted3, plain]));
    expect(slugs(selectProducts(all, { ids, sort: 'best_selling' }, ctx))).toEqual(
      slugs([plain, promoted3]),
    );
  });
});

describe('runSearch', () => {
  const list = Array.from({ length: 30 }, (_, i) =>
    product({
      title: i % 2 ? `Matte Lipstick ${i}` : `Glow Serum ${i}`,
      soldCount: 100 - i,
      sponsored: i === 7 || i === 20 || i === 25,
      price: 100_000 + i * 1000,
    }),
  );

  it('pages 24 at a time and reports the total and page count', () => {
    const first = SearchResult.parse(runSearch(list, {}, ctx));
    expect(first.items).toHaveLength(24);
    expect(first).toMatchObject({ total: 30, page: 1, pageSize: 24, pageCount: 2 });
    const second = runSearch(list, { page: 2 }, ctx);
    expect(second.items).toHaveLength(6);
    const small = runSearch(list, { pageSize: 7, page: 5 }, ctx);
    expect(small).toMatchObject({ total: 30, pageCount: 5 });
    expect(small.items).toHaveLength(2);
  });

  it('returns no items with the real total past the last page', () => {
    const past = runSearch(list, { page: 9 }, ctx);
    expect(past.items).toEqual([]);
    expect(past.total).toBe(30);
    expect(past.pageCount).toBe(2);
    const none = runSearch(list, { q: 'xyzzy' }, ctx);
    expect(none).toMatchObject({ items: [], total: 0, pageCount: 0 });
    expect(none.facets.price).toBeNull();
  });

  it('pins sponsored products on page 1 only, never twice across pages', () => {
    const pages = [1, 2, 3].map((page) => runSearch(list, { page, pageSize: 10 }, ctx).items);
    expect(pages[0]?.slice(0, 2).map((p) => p.slug)).toEqual([list[7]?.slug, list[20]?.slug]);
    const seen = pages.flat().map((p) => p.slug);
    expect(new Set(seen).size).toBe(30);
    // The third sponsored product keeps its place.
    const all = runSearch(list, { pageSize: 48 }, ctx).items.map((p) => p.slug);
    expect(all.indexOf(list[25]?.slug ?? '')).toBe(25);
  });

  it('orders a text search by relevance, sponsored first; an explicit sort wins', () => {
    const relevance = runSearch(list, { q: 'matte lipstick', pageSize: 48 }, ctx);
    expect(relevance.total).toBe(15);
    expect(relevance.items[0]?.slug).toBe(list[7]?.slug);
    expect(relevance.items[1]?.slug).toBe(list[25]?.slug);
    expect(relevance.items.every((p) => p.title.startsWith('Matte Lipstick'))).toBe(true);
    const cheap = runSearch(list, { q: 'matte lipstick', sort: 'price_asc', pageSize: 48 }, ctx);
    const prices = cheap.items.map((p) => p.price);
    expect(prices).toEqual([...prices].sort((x, y) => x - y));
  });

  it('returns cards, not full products', () => {
    const { items } = runSearch(list, { pageSize: 1 }, ctx);
    expect(Object.keys(items[0] ?? {}).sort()).toEqual(Object.keys(ProductCard.shape).sort());
  });
});

describe('toProductCard', () => {
  it('keeps exactly the ProductCard fields', () => {
    const p = product({ sponsored: true });
    const card = toProductCard(p);
    expect(Object.keys(card).sort()).toEqual(Object.keys(ProductCard.shape).sort());
    expect(ProductCard.strict().parse(card)).toEqual(card);
    expect(card.sponsored).toBe(true);
  });
});

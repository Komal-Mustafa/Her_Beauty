import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { createPrismaClient, uuidv7 } from '@hb/db';
import {
  DeliveryEstimate,
  discountPercent,
  FALLBACK_COURIER_DAYS,
  isOnSale,
  Page,
  PK_CITIES,
  ProductCard,
  SEARCH_PAGE_SIZE,
  SearchResult,
  SHADE_FAMILY_HEX,
  ShadeFamily,
  shadeFamily,
  type DeliveryZone,
  type PkCity,
  type ProductQuery,
  type SearchQuery,
} from '@hb/types';
import {
  ApiRequestError,
  createHttpApi,
  discountPercent as badgePercent,
  STOREFRONT_KEY_HEADER as SDK_STOREFRONT_KEY_HEADER,
  type HbApi,
} from '@hb/sdk';
import { mockApi } from '@hb/sdk/mock';
import {
  categories as fixtureCategories,
  products as fixtureProducts,
  shippingProfiles,
  sponsoredProductSlugs,
  stores as fixtureStores,
} from '@hb/sdk/fixtures';
import { STOREFRONT_KEY_HEADER } from '../src/common/throttler.guard';
import { Api, createTestApp, ErrorBody, hasDb, nextIp } from './helpers';

/**
 * P5a catalogue (docs/p5-catalog.md §3.3, §4, §11): GET /v1/search, the new GET /v1/products
 * fields and GET /v1/products/:slug/delivery against the migrated + seeded database, and parity
 * with the mock adapter over the same fixtures.
 */
const RUN = Date.now().toString(36);

type Card = ProductCard;

function must<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null) throw new Error(`missing ${what}`);
  return value;
}

/** How many fixture products fall in each bucket (buckets of 0 are left out). */
function tally<T>(list: readonly T[], key: (item: T) => string | string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of list) {
    const keys = key(item);
    for (const k of new Set(Array.isArray(keys) ? keys : [keys])) out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/** Facet options as { value: count }, without the zero counts. */
const counts = (options: readonly { value: string; count: number }[]) =>
  Object.fromEntries(options.filter((o) => o.count > 0).map((o) => [o.value, o.count]));

const categorySlugOf = (categoryId: string) =>
  must(
    fixtureCategories.find((c) => c.id === categoryId),
    categoryId,
  ).slug;

const families = (p: { shades: readonly { hex: string }[] }) =>
  p.shades.map((s) => shadeFamily(s.hex));

describe.skipIf(!hasDb)('P5a catalogue: search, product filters and delivery', () => {
  let app: INestApplication;
  let api: Api;
  const db = createPrismaClient();
  // Rows that must stay hidden: a suspended seller's live product and a draft; removed in afterAll.
  const hidden = {
    userId: uuidv7(),
    sellerId: uuidv7(),
    suspendedProductId: uuidv7(),
    draftProductId: uuidv7(),
    suspendedSlug: `p5-hidden-suspended-${RUN}`,
    draftSlug: `p5-hidden-draft-${RUN}`,
    title: `Zyxwv Hidden Glow ${RUN}`,
  };

  beforeAll(async () => {
    ({ app } = await createTestApp());
    api = new Api(app);
    const live = await db.product.findFirstOrThrow({
      where: { status: 'live', slug: 'velvet-matte-lipstick' },
      select: { sellerId: true, brandId: true, categoryId: true },
    });
    await db.user.create({
      data: {
        id: hidden.userId,
        email: `p5-hidden-${RUN}@owner.test`,
        fullName: 'P5 Hidden Owner',
        role: 'seller',
      },
    });
    await db.seller.create({
      data: {
        id: hidden.sellerId,
        ownerUserId: hidden.userId,
        type: 'vendor',
        status: 'suspended',
        storeName: `P5 Suspended ${RUN}`,
        slug: `p5-suspended-${RUN}`,
        city: 'Lahore',
      },
    });
    const base = { brandId: live.brandId, categoryId: live.categoryId, title: hidden.title };
    await db.product.createMany({
      data: [
        {
          ...base,
          id: hidden.suspendedProductId,
          sellerId: hidden.sellerId,
          slug: hidden.suspendedSlug,
          status: 'live',
        },
        {
          ...base,
          id: hidden.draftProductId,
          sellerId: live.sellerId,
          slug: hidden.draftSlug,
          status: 'draft',
        },
      ],
    });
  });

  afterAll(async () => {
    await db.product.deleteMany({
      where: { id: { in: [hidden.suspendedProductId, hidden.draftProductId] } },
    });
    await db.seller.deleteMany({ where: { id: hidden.sellerId } });
    await db.user.deleteMany({ where: { id: hidden.userId } });
    await db.$disconnect();
    await app?.close();
  });

  const search = async (qs = '') =>
    SearchResult.parse((await api.get(`/search${qs}`).expect(200)).body);
  const list = async (qs = '') =>
    Page(ProductCard).parse((await api.get(`/products${qs}`).expect(200)).body);
  const slugs = (items: readonly Card[]) => items.map((p) => p.slug);
  const sorted = (values: readonly string[]) => [...values].sort();

  const onSaleFixtures = fixtureProducts.filter(isOnSale);
  const newFixtures = fixtureProducts.filter((p) => p.isNew);

  describe('GET /v1/search', () => {
    it('pages the live catalogue with the default page size, and past the end', async () => {
      const first = await search();
      expect(first).toMatchObject({
        total: fixtureProducts.length,
        page: 1,
        pageSize: SEARCH_PAGE_SIZE,
        pageCount: Math.ceil(fixtureProducts.length / SEARCH_PAGE_SIZE),
      });
      expect(first.items).toHaveLength(SEARCH_PAGE_SIZE);
      const second = await search('?page=2');
      expect(sorted([...slugs(first.items), ...slugs(second.items)])).toEqual(
        sorted(fixtureProducts.map((p) => p.slug)),
      );
      // Past the end: no items, the real total.
      const past = await search('?page=3');
      expect(past.items).toEqual([]);
      expect(past).toMatchObject({ total: fixtureProducts.length, page: 3, pageCount: 2 });
      const far = await search('?page=500&pageSize=48');
      expect(far.items).toEqual([]);
      expect(far.total).toBe(fixtureProducts.length);
    });

    it('returns exactly the SearchResult fields', async () => {
      const res = await api.get('/search?pageSize=1').expect(200);
      expect(SearchResult.strict().parse(res.body).items).toHaveLength(1);
      expect(Object.keys(res.body.items[0]).sort()).toEqual(Object.keys(ProductCard.shape).sort());
    });

    it('passes the must-pass text cases (docs/p5-catalog.md §4)', async () => {
      const lipsticks = fixtureProducts.filter((p) => /lipstick/i.test(p.title));
      expect(lipsticks.length).toBeGreaterThanOrEqual(3);
      const typo = await search('?q=lipstik');
      expect(sorted(slugs(typo.items))).toEqual(sorted(lipsticks.map((p) => p.slug)));

      const lumiere = await search('?q=lumiere');
      expect(slugs(lumiere.items)).toContain('lumiere-highlighter');
      const accented = await search(`?q=${encodeURIComponent('LUMIÈRE')}`);
      expect(slugs(accented.items)).toEqual(slugs(lumiere.items));

      const both = await search('?q=vitamin%20serum');
      expect(slugs(both.items)).toEqual(['vitamin-c-glow-serum']);
      const serums = await search('?q=serum');
      expect(serums.total).toBeGreaterThan(both.total);

      const velvet = await search('?q=velvet');
      expect(velvet.total).toBeGreaterThan(0);
      expect(velvet.items[0]?.slug).toBe('velvet-matte-lipstick');
      for (const p of velvet.items) {
        expect(p.brand.slug === 'velvet' || p.slug === 'velvet-matte-lipstick', p.slug).toBe(true);
      }

      const none = await search('?q=xyzzy');
      expect(none).toMatchObject({ items: [], total: 0, pageCount: 0 });
      expect(none.facets.price).toBeNull();
      expect(none.facets.brands.every((b) => b.count === 0)).toBe(true);
    });

    it('uses typos only for a word no product has, and finds shades by family', async () => {
      const having = (word: string) =>
        fixtureProducts.filter(
          (p) => p.title.toLowerCase().split(' ').includes(word) || p.tags.includes(word),
        );
      for (const word of ['blush', 'brush']) {
        const res = await search(`?q=${word}&pageSize=48`);
        expect(sorted(slugs(res.items)), word).toEqual(sorted(having(word).map((p) => p.slug)));
      }
      const red = await search('?q=red%20lipstick&pageSize=48');
      expect(slugs(red.items)).toContain('mehr-liquid-lipstick'); // Chilli: no "red" in the name
      for (const card of red.items) expect(families(card), card.slug).toContain('red');
    });

    it('never returns hidden products, even by their exact title', async () => {
      const res = await search(`?q=${encodeURIComponent(hidden.title)}&pageSize=48`);
      expect(res.total).toBe(0);
      const all = await search('?pageSize=48');
      expect(slugs(all.items)).not.toContain(hidden.suspendedSlug);
      expect(slugs(all.items)).not.toContain(hidden.draftSlug);
    });

    it('pins up to 2 sponsored products on default and relevance order, never twice', async () => {
      const sponsored = new Set(sponsoredProductSlugs);
      const seen: Card[] = [];
      for (let page = 1; page <= 5; page++)
        seen.push(...(await search(`?page=${page}&pageSize=10`)).items);
      expect(seen).toHaveLength(fixtureProducts.length);
      expect(new Set(slugs(seen)).size).toBe(seen.length);
      expect(seen.slice(0, 2).every((p) => p.sponsored && sponsored.has(p.slug))).toBe(true);
      expect(
        seen
          .filter((p) => p.sponsored)
          .map((p) => p.slug)
          .sort(),
      ).toEqual([...sponsored].sort());
      // The third sponsored product stays where the order puts it.
      expect(seen.findIndex((p, i) => i >= 2 && p.sponsored)).toBeGreaterThan(2);

      const relevance = await search('?q=serum&sort=relevance');
      expect(relevance.items.slice(0, 2).every((p) => p.sponsored)).toBe(true);
      // An explicit sort is never reordered for ads.
      const cheap = await search('?q=serum&sort=price_asc');
      const prices = cheap.items.map((p) => p.price);
      expect(prices).toEqual([...prices].sort((a, b) => a - b));
    });

    it('counts facets disjunctively, so several brands can be ticked', async () => {
      const all = await search();
      const byBrand = tally(fixtureProducts, (p) => p.brand.slug);
      expect(counts(all.facets.brands)).toEqual(byBrand);
      const labels = all.facets.brands.map((b) => b.label);
      expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, 'en')));

      const one = await search('?brand=glow');
      expect(one.total).toBe(byBrand.glow);
      expect(one.facets.brands).toEqual(all.facets.brands);

      const two = await search('?brand=glow,velvet&pageSize=48');
      const ticked = fixtureProducts.filter((p) => ['glow', 'velvet'].includes(p.brand.slug));
      expect(two.total).toBe(ticked.length);
      expect(sorted(slugs(two.items))).toEqual(sorted(ticked.map((p) => p.slug)));
      expect(two.facets.brands).toEqual(all.facets.brands);
      // Every other group narrows to the ticked brands.
      expect(counts(two.facets.categories)).toEqual(
        tally(ticked, (p) => categorySlugOf(p.categoryId)),
      );
      expect(counts(two.facets.shades)).toEqual(tally(ticked, families));
      expect(two.facets.onSale).toBe(ticked.filter(isOnSale).length);
    });

    it('counts every group of the whole catalogue, in a fixed option order', async () => {
      const { facets } = await search();
      expect(facets.categories.map((c) => c.value)).toEqual(fixtureCategories.map((c) => c.slug));
      expect(counts(facets.categories)).toEqual(
        tally(fixtureProducts, (p) => categorySlugOf(p.categoryId)),
      );
      expect(facets.shades.map((s) => [s.value, s.hex])).toEqual(
        ShadeFamily.options.map((f) => [f, SHADE_FAMILY_HEX[f]]),
      );
      expect(counts(facets.shades)).toEqual(tally(fixtureProducts, families));
      expect(counts(facets.skinTypes)).toEqual(tally(fixtureProducts, (p) => p.skinTypes));
      expect(counts(facets.sellerTypes)).toEqual(tally(fixtureProducts, (p) => p.seller.type));
      expect(facets.ratings).toEqual([
        {
          value: '4',
          label: '4 stars & up',
          count: fixtureProducts.filter((p) => p.rating >= 4).length,
        },
        {
          value: '3',
          label: '3 stars & up',
          count: fixtureProducts.filter((p) => p.rating >= 3).length,
        },
      ]);
      expect(facets.onSale).toBe(onSaleFixtures.length);
      const prices = fixtureProducts.map((p) => p.price);
      expect(facets.price).toEqual({ min: Math.min(...prices), max: Math.max(...prices) });
    });

    it('applies a fixed page filter to every other group, and price only to the items', async () => {
      const lips = await search('?category=lips&pageSize=48');
      const lipFixtures = fixtureProducts.filter((p) => categorySlugOf(p.categoryId) === 'lips');
      expect(lips.total).toBe(lipFixtures.length);
      expect(counts(lips.facets.brands)).toEqual(tally(lipFixtures, (p) => p.brand.slug));

      const pricey = await search('?category=lips&minPrice=140000&pageSize=48');
      const above = lipFixtures.filter((p) => p.price >= 140_000);
      expect(above.length).toBeGreaterThan(0);
      expect(above.length).toBeLessThan(lipFixtures.length);
      expect(sorted(slugs(pricey.items))).toEqual(sorted(above.map((p) => p.slug)));
      expect(pricey.facets.price).toEqual(lips.facets.price);
      expect(counts(pricey.facets.brands)).toEqual(tally(above, (p) => p.brand.slug));
    });

    it('filters by shade family, sale, new, skin type, seller type and rating', async () => {
      const gold = await search('?shade=gold&pageSize=48');
      const goldFixtures = fixtureProducts.filter((p) => families(p).includes('gold'));
      expect(goldFixtures.length).toBeGreaterThan(0);
      expect(sorted(slugs(gold.items))).toEqual(sorted(goldFixtures.map((p) => p.slug)));
      const warm = await search('?shade=red,berry&pageSize=48');
      expect(warm.total).toBe(
        fixtureProducts.filter((p) => families(p).some((f) => f === 'red' || f === 'berry')).length,
      );

      const sale = await search('?onSale=true&pageSize=48');
      expect(sorted(slugs(sale.items))).toEqual(sorted(onSaleFixtures.map((p) => p.slug)));
      const full = await search('?onSale=false&pageSize=48');
      expect(full.total).toBe(fixtureProducts.length - onSaleFixtures.length);
      expect(full.items.some(isOnSale)).toBe(false);

      const fresh = await search('?isNew=true&pageSize=48');
      expect(sorted(slugs(fresh.items))).toEqual(sorted(newFixtures.map((p) => p.slug)));
      expect((await search('?isNew=false')).total).toBe(
        fixtureProducts.length - newFixtures.length,
      );

      const oily = await search('?skinType=oily,sensitive&sellerType=vendor&minRating=4.5');
      const expected = fixtureProducts.filter(
        (p) =>
          p.skinTypes.some((s) => s === 'oily' || s === 'sensitive') &&
          p.seller.type === 'vendor' &&
          p.rating >= 4.5,
      );
      expect(expected.length).toBeGreaterThan(0);
      expect(sorted(slugs(oily.items))).toEqual(sorted(expected.map((p) => p.slug)));

      const store = await search('?seller=chandni-glam&pageSize=48');
      expect(store.total).toBe(
        fixtureProducts.filter((p) => p.seller.slug === 'chandni-glam').length,
      );
    });

    it('sorts by price, rating, newness and discount', async () => {
      const byPrice = (await search('?sort=price_desc&pageSize=48')).items.map((p) => p.price);
      expect(byPrice).toHaveLength(fixtureProducts.length);
      expect(byPrice).toEqual([...byPrice].sort((a, b) => b - a));

      const rated = (await search('?sort=rating&pageSize=48')).items;
      for (let i = 1; i < rated.length; i++) {
        const [a, b] = [must(rated[i - 1], 'prev'), must(rated[i], 'next')];
        expect(
          a.rating > b.rating || (a.rating === b.rating && a.ratingCount >= b.ratingCount),
        ).toBe(true);
      }

      const newest = (await search('?sort=newest&pageSize=48')).items.map((p) => p.isNew);
      expect(newest).toEqual([...newest].sort((a, b) => Number(b) - Number(a)));

      const discount = (await search('?sort=discount&onSale=true&pageSize=48')).items;
      const off = discount.map((p) => discountPercent(p.price, p.compareAtPrice));
      expect(off).toEqual([...off].sort((a, b) => b - a));
      expect(off.every((n) => n > 0)).toBe(true);
      // The "-n%" badge shoppers see is the sort key, so badges never go up down the list.
      expect(discount.map((p) => badgePercent(p.price, p.compareAtPrice))).toEqual(off);
      for (let i = 1; i < discount.length; i++) {
        if (off[i] === off[i - 1]) {
          expect(must(discount[i], 'item').price).toBeGreaterThanOrEqual(
            must(discount[i - 1], 'item').price,
          );
        }
      }
    });

    it.each([
      ['an unknown parameter', '?foo=1'],
      ['a cursor (pages are numbered)', '?cursor=abc'],
      ['a limit (use pageSize)', '?limit=10'],
      ['ids (a /products filter only)', '?ids=abc'],
      ['a non-boolean onSale', '?onSale=yes'],
      ['a numeric isNew', '?isNew=1'],
      ['onSale given twice', '?onSale=true&onSale=false'],
      ['page 0', '?page=0'],
      ['page 501', '?page=501'],
      ['a fractional page', '?page=1.5'],
      ['a non-numeric page', '?page=two'],
      ['a page size above 48', '?pageSize=49'],
      ['an unknown shade family', '?shade=teal'],
      ['an unknown sort', '?sort=cheapest'],
      ['a malformed brand slug', '?brand=Glow!'],
      ['a text query over 100 characters', `?q=${'a'.repeat(101)}`],
    ])('rejects %s with 400 VALIDATION_FAILED', async (_why, qs) => {
      const res = await api.get(`/search${qs}`).expect(400);
      expect(ErrorBody.parse(res.body).error.code).toBe('VALIDATION_FAILED');
    });

    it('limits search to 60 requests a minute per client IP', async () => {
      const ip = nextIp();
      for (let i = 0; i < 60; i++) await api.get('/search?pageSize=1', undefined, ip).expect(200);
      const limited = await api.get('/search?pageSize=1', undefined, ip).expect(429);
      expect(ErrorBody.parse(limited.body).error.code).toBe('RATE_LIMITED');
      // Other shoppers are unaffected.
      await api.get('/search?pageSize=1').expect(200);
    });

    describe("the storefront server's reads (SSR for many shoppers from one IP)", () => {
      const key = must(process.env.STOREFRONT_API_KEY, 'STOREFRONT_API_KEY');
      const fromServer = (path: string, ip: string, sentKey: string = key) =>
        api.raw().get(`/v1${path}`).set('X-Forwarded-For', ip).set(STOREFRONT_KEY_HEADER, sentKey);

      it('uses the header the SDK sends', () => {
        expect(SDK_STOREFRONT_KEY_HEADER).toBe(STOREFRONT_KEY_HEADER);
      });

      it('are not throttled as one client', async () => {
        const serverIp = nextIp();
        // 70 shoppers' listing pages, each a different URL, through one storefront server.
        for (let page = 1; page <= 70; page++) {
          const res = await fromServer(`/search?pageSize=1&page=${page}`, serverIp).expect(200);
          expect(res.headers['x-ratelimit-remaining']).toBeUndefined();
        }
        // The storefront server's other public reads are not counted either.
        const product = await fromServer('/products/velvet-matte-lipstick', serverIp).expect(200);
        expect(product.headers['x-ratelimit-remaining']).toBeUndefined();
        // The same IP without the key is an ordinary client with a fresh allowance.
        const plain = await api.get('/search?pageSize=1', undefined, serverIp).expect(200);
        expect(plain.headers['x-ratelimit-remaining']).toBe('59');
      });

      it('still counts a wrong key, writes and signed-in routes per IP', async () => {
        const ip = nextIp();
        const wrong = await fromServer('/search?pageSize=1', ip, `${key}x`).expect(200);
        expect(wrong.headers['x-ratelimit-remaining']).toBe('59');
        const signedIn = await fromServer('/me', ip).expect(401);
        expect(signedIn.headers['x-ratelimit-remaining']).toBeDefined();
        for (let i = 0; i < 5; i++) {
          await api
            .raw()
            .post('/v1/auth/register')
            .set('X-Forwarded-For', ip)
            .set(STOREFRONT_KEY_HEADER, key)
            .send({})
            .expect(400);
        }
        const limited = await api
          .raw()
          .post('/v1/auth/register')
          .set('X-Forwarded-For', ip)
          .set(STOREFRONT_KEY_HEADER, key)
          .send({})
          .expect(429);
        expect(ErrorBody.parse(limited.body).error.code).toBe('RATE_LIMITED');
      });
    });
  });

  describe('GET /v1/products (new fields)', () => {
    it('filters by shade family, sale and new, with the typo-tolerant matcher', async () => {
      const gold = await list('?shade=gold&limit=100');
      expect(gold.items.every((p) => families(p).includes('gold'))).toBe(true);
      expect(gold.items.length).toBe(
        fixtureProducts.filter((p) => families(p).includes('gold')).length,
      );
      const sale = await list('?onSale=true&limit=100');
      expect(sorted(slugs(sale.items))).toEqual(sorted(onSaleFixtures.map((p) => p.slug)));
      const fresh = await list('?isNew=true&limit=100');
      expect(sorted(slugs(fresh.items))).toEqual(sorted(newFixtures.map((p) => p.slug)));
      const typo = await list('?q=lipstik&limit=100');
      expect(slugs(typo.items)).toContain('velvet-matte-lipstick');
    });

    it('sorts by biggest discount, cheapest first on a tie', async () => {
      const page = await list('?sort=discount&limit=100');
      expect(page.items).toHaveLength(fixtureProducts.length);
      const off = page.items.map((p) => discountPercent(p.price, p.compareAtPrice));
      expect(off).toEqual([...off].sort((a, b) => b - a));
      expect(off.filter((n) => n > 0)).toHaveLength(onSaleFixtures.length);
    });

    it('returns exactly the requested ids in order, skipping hidden, unknown and non-UUID ids', async () => {
      const all = await list('?limit=100');
      const idOf = (slug: string) =>
        must(
          all.items.find((p) => p.slug === slug),
          slug,
        ).id;
      const wanted = ['rose-water-cream', 'velvet-matte-lipstick', 'gold-kabuki-brush'];
      const ids = [
        idOf(wanted[0] ?? ''),
        hidden.suspendedProductId,
        'prd-1',
        idOf(wanted[1] ?? ''),
        uuidv7(),
        hidden.draftProductId,
        idOf(wanted[2] ?? ''),
      ];
      const page = await list(`?ids=${ids.join(',')}`);
      expect(slugs(page.items)).toEqual(wanted);
      expect(page.nextCursor).toBeNull();
      // An explicit sort still wins over the ids order.
      const cheap = await list(`?ids=${ids.join(',')}&sort=price_asc`);
      const prices = cheap.items.map((p) => p.price);
      expect(prices).toEqual([...prices].sort((a, b) => a - b));
      expect(sorted(slugs(cheap.items))).toEqual(sorted(wanted));
    });

    it.each([
      ['more than 50 ids', `?ids=${Array.from({ length: 51 }, () => uuidv7()).join(',')}`],
      ['an empty ids list', '?ids='],
      ['a non-boolean onSale', '?onSale=1'],
      ['a non-boolean isNew', '?isNew=yes'],
      ['an unknown shade family', '?shade=blue'],
      ['a page number (use the cursor)', '?page=2'],
      ['an unknown parameter', '?colour=red'],
    ])('rejects %s with 400 VALIDATION_FAILED', async (_why, qs) => {
      const res = await api.get(`/products${qs}`).expect(400);
      expect(ErrorBody.parse(res.body).error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('GET /v1/products/:slug/delivery', () => {
    const productOf = (sellerSlug: string) =>
      must(
        fixtureProducts.find((p) => p.seller.slug === sellerSlug),
        sellerSlug,
      ).slug;

    /** What the seller's fixture profile says, read independently of the shared helper. */
    function expected(sellerSlug: string, city: PkCity, zone: DeliveryZone): DeliveryEstimate {
      const store = must(
        fixtureStores.find((s) => s.slug === sellerSlug),
        sellerSlug,
      );
      const profile = must(shippingProfiles[store.id], store.id);
      const lightest = (z: DeliveryZone) =>
        profile.rates.filter((r) => r.zone === z).sort((a, b) => a.minWeightG - b.minWeightG)[0];
      const band = lightest(zone);
      const courier = band ?? lightest('nationwide');
      return {
        city,
        zone,
        daysMin: profile.handlingDays + (courier?.daysMin ?? FALLBACK_COURIER_DAYS.min),
        daysMax: profile.handlingDays + (courier?.daysMax ?? FALLBACK_COURIER_DAYS.max),
        fee: band?.price ?? null,
        freeShippingMin: profile.freeShippingMin,
        codAvailable: profile.codEnabled,
      };
    }

    const delivery = async (slug: string, city: string) =>
      DeliveryEstimate.strict().parse(
        (await api.get(`/products/${slug}/delivery?city=${encodeURIComponent(city)}`).expect(200))
          .body,
      );

    it.each<[string, PkCity, DeliveryZone]>([
      ['glow-cosmetics', 'Lahore', 'same_city'],
      ['glow-cosmetics', 'Multan', 'province'],
      ['glow-cosmetics', 'Islamabad', 'province'],
      ['glow-cosmetics', 'Karachi', 'nationwide'],
      ['glow-cosmetics', 'Gilgit', 'remote'],
      ['rose-house', 'Rawalpindi', 'same_city'],
      ['rose-house', 'Islamabad', 'same_city'],
      ['rose-house', 'Faisalabad', 'province'],
      ['rose-house', 'Peshawar', 'nationwide'],
      ['rose-house', 'Skardu', 'remote'],
      ['chandni-glam', 'Islamabad', 'same_city'],
      ['chandni-glam', 'Lahore', 'province'],
      ['sahil-beauty', 'Karachi', 'same_city'],
      ['sahil-beauty', 'Hyderabad', 'province'],
      ['sahil-beauty', 'Quetta', 'nationwide'],
      ['sahil-beauty', 'Gwadar', 'remote'],
      ['gulposh-beauty', 'Abbottabad', 'province'],
      ['gulposh-beauty', 'Muzaffarabad', 'nationwide'],
      ['velvet-studio', 'Faisalabad', 'same_city'],
      ['velvet-studio', 'Sialkot', 'province'],
      ['skin-lab', 'Turbat', 'remote'],
      ['beauty-point', 'Larkana', 'province'],
    ])('%s → %s is %s', async (seller, city, zone) => {
      expect(await delivery(productOf(seller), city)).toEqual(expected(seller, city, zone));
    });

    it('leaves the fee to checkout without a rate for the zone, and reports COD', async () => {
      const skardu = await delivery(productOf('rose-house'), 'Skardu');
      expect(skardu).toMatchObject({ fee: null, daysMin: 5, daysMax: 7, codAvailable: false });
      const gwadar = await delivery(productOf('sahil-beauty'), 'Gwadar');
      expect(gwadar).toMatchObject({ fee: null, codAvailable: true });
      // The lightest band, whatever order the rates were saved in.
      const karachi = await delivery(productOf('sahil-beauty'), 'Karachi');
      expect(karachi.fee).toBe(15_000);
      expect((await delivery(productOf('velvet-studio'), 'Lahore')).freeShippingMin).toBeNull();
    });

    it('uses the defaults for a seller without shipping settings', async () => {
      const userId = uuidv7();
      const sellerId = uuidv7();
      const productId = uuidv7();
      const slug = `p5-no-settings-${RUN}`;
      const live = await db.product.findFirstOrThrow({
        where: { slug: 'velvet-matte-lipstick' },
        select: { brandId: true, categoryId: true },
      });
      await db.user.create({
        data: { id: userId, email: `${slug}@owner.test`, fullName: 'P5 Owner', role: 'seller' },
      });
      await db.seller.create({
        data: {
          id: sellerId,
          ownerUserId: userId,
          type: 'vendor',
          status: 'approved',
          storeName: `P5 No Settings ${RUN}`,
          slug,
          city: 'Quetta',
        },
      });
      await db.product.create({
        data: {
          id: productId,
          sellerId,
          ...live,
          title: 'P5 test product',
          slug,
          status: 'live',
          variants: { create: { id: uuidv7(), sku: `P5-${RUN}`, price: 150_000n, stock: 5 } },
        },
      });
      try {
        const defaults = { fee: null, freeShippingMin: null, codAvailable: true };
        expect(await delivery(slug, 'Gwadar')).toEqual({
          city: 'Gwadar',
          zone: 'remote',
          daysMin: 1 + FALLBACK_COURIER_DAYS.min,
          daysMax: 1 + FALLBACK_COURIER_DAYS.max,
          ...defaults,
        });
        expect(await delivery(slug, 'Lahore')).toMatchObject({ zone: 'nationwide', ...defaults });
      } finally {
        await db.product.deleteMany({ where: { id: productId } });
        await db.seller.deleteMany({ where: { id: sellerId } });
        await db.user.deleteMany({ where: { id: userId } });
      }
    });

    it.each([
      ['an unknown city', '?city=Dubai'],
      ['a lower-case city', '?city=lahore'],
      ['no city', ''],
      ['an empty city', '?city='],
      ['a city given twice', '?city=Lahore&city=Karachi'],
      ['an unknown parameter', '?city=Lahore&weight=500'],
    ])('rejects %s with 400 VALIDATION_FAILED', async (_why, qs) => {
      const res = await api.get(`/products/velvet-matte-lipstick/delivery${qs}`).expect(400);
      expect(ErrorBody.parse(res.body).error.code).toBe('VALIDATION_FAILED');
    });

    it('404s for unknown products and products that are not on sale', async () => {
      for (const slug of ['no-such-product', hidden.suspendedSlug, hidden.draftSlug]) {
        const res = await api.get(`/products/${slug}/delivery?city=Lahore`).expect(404);
        expect(ErrorBody.parse(res.body).error.code).toBe('NOT_FOUND');
      }
      await api.get('/products/Not_A_Slug/delivery?city=Lahore').expect(400);
    });
  });

  describe('mock and HTTP adapters agree', () => {
    let http: HbApi;
    // Ids differ between the fixtures and the seed; everything else must match.
    let categorySlug: Map<string, string>;
    const mockCategorySlug = new Map(fixtureCategories.map((c) => [c.id, c.slug]));

    beforeAll(async () => {
      http = createHttpApi({
        baseUrl: 'http://api.test/v1',
        revalidate: 0,
        // Through the in-process app, one client IP per request (like many shoppers).
        fetch: async (input) => {
          const url = new URL(input);
          const res = await api
            .raw()
            .get(`${url.pathname}${url.search}`)
            .set('X-Forwarded-For', nextIp());
          return new Response(res.text, {
            status: res.status,
            headers: { 'content-type': 'application/json' },
          });
        },
      });
      categorySlug = new Map((await http.getCategories()).map((c) => [c.id, c.slug]));
    });

    const shown = (c: Card, catSlug: ReadonlyMap<string, string>) => {
      const {
        id: _id,
        categoryId,
        quickAddVariantId,
        brand: { id: _brandId, ...brand },
        seller: { id: _sellerId, ...seller },
        ...rest
      } = c;
      return {
        ...rest,
        brand,
        seller,
        category: catSlug.get(categoryId),
        quickAdd: quickAddVariantId !== null,
      };
    };

    const searches: SearchQuery[] = [
      {},
      { page: 2 },
      { page: 3 },
      { pageSize: 7, page: 4 },
      { q: 'velvet' },
      { q: 'lipstik' },
      { q: 'vitamin serum' },
      { q: 'rose', sort: 'relevance' },
      { q: 'sunscrean' },
      { q: 'saffron & co' },
      { q: 'xyzzy' },
      { q: 'blush' },
      { q: 'brush', pageSize: 48 },
      { q: 'red lipstick' },
      { q: 'blush', category: 'tools' },
      { category: 'lips', shade: ['red', 'berry'] },
      { category: 'skincare', skinType: ['oily'], minRating: 4 },
      { brand: ['glow', 'velvet'], sort: 'price_asc' },
      { onSale: true, sort: 'discount' },
      { onSale: false, sort: 'rating' },
      { isNew: true },
      { sellerType: 'manufacturer', pageSize: 10, page: 2 },
      { seller: 'beauty-point', sort: 'newest' },
      { minPrice: 100_000, maxPrice: 300_000, sort: 'best_selling' },
      { shade: ['gold'], sort: 'price_desc' },
    ];

    it.each(searches.map((q) => [JSON.stringify(q), q] as const))(
      'search %s',
      async (_label, query) => {
        const [fromMock, fromHttp] = await Promise.all([mockApi.search(query), http.search(query)]);
        const view = (r: SearchResult, catSlug: ReadonlyMap<string, string>) => ({
          ...r,
          items: r.items.map((c) => shown(c, catSlug)),
        });
        expect(view(fromHttp, categorySlug)).toEqual(view(fromMock, mockCategorySlug));
      },
    );

    const productQueries: ProductQuery[] = [
      { limit: 100 },
      { limit: 5, sort: 'price_asc' },
      { shade: ['gold', 'nude'], limit: 100 },
      { onSale: true, sort: 'discount', limit: 100 },
      { isNew: true, limit: 100 },
      { q: 'serum', limit: 100 },
      { category: 'eyes', sort: 'rating', limit: 100 },
      { q: 'red lipstick', limit: 100 },
      // The API loads only the Tools rows: "blush" has no exact match there, so both read it as
      // a typo of "brush" (search judges against every product and finds nothing).
      { q: 'blush', category: 'tools', limit: 100 },
      { q: 'blush', seller: 'beauty-point', limit: 100 },
    ];

    it.each(productQueries.map((q) => [JSON.stringify(q), q] as const))(
      'getProducts %s',
      async (_label, query) => {
        const [fromMock, fromHttp] = await Promise.all([
          mockApi.getProducts(query),
          http.getProducts(query),
        ]);
        expect(fromHttp.items.map((c) => shown(c, categorySlug))).toEqual(
          fromMock.items.map((c) => shown(c, mockCategorySlug)),
        );
        expect(fromHttp.nextCursor === null).toBe(fromMock.nextCursor === null);
      },
    );

    it('getProducts by ids, in the requested order', async () => {
      const wanted = [
        'oud-blush-parfum',
        'silk-lip-oil',
        'qalam-eyelash-curler',
        'peony-blush-compact',
      ];
      const live = await http.getProducts({ limit: 100 });
      const httpIds = wanted.map(
        (s) =>
          must(
            live.items.find((p) => p.slug === s),
            s,
          ).id,
      );
      const mockIds = wanted.map(
        (s) =>
          must(
            fixtureProducts.find((p) => p.slug === s),
            s,
          ).id,
      );
      const [fromMock, fromHttp] = await Promise.all([
        mockApi.getProducts({ ids: mockIds }),
        http.getProducts({ ids: httpIds }),
      ]);
      expect(slugs(fromHttp.items)).toEqual(wanted);
      expect(slugs(fromMock.items)).toEqual(wanted);
    });

    it('rejects the same bad queries alike', async () => {
      // Each query type-checks as the other; both endpoints are strict, so the extra field is a 400.
      const carouselQuery: ProductQuery = { category: 'lips', limit: 12 };
      const listingQuery: SearchQuery = { category: 'lips', page: 2 };
      for (const call of [
        (a: HbApi) => a.search({ page: 0 }),
        (a: HbApi) => a.search({ pageSize: 49 }),
        (a: HbApi) => a.search(carouselQuery),
        (a: HbApi) => a.search({ ids: ['prd-1'] } as ProductQuery),
        (a: HbApi) => a.getProducts({ limit: 101 }),
        (a: HbApi) => a.getProducts(listingQuery),
        (a: HbApi) => a.getProducts({ pageSize: 10 } as SearchQuery),
        (a: HbApi) => a.getDeliveryEstimate('velvet-matte-lipstick', 'Dubai' as PkCity),
      ]) {
        for (const adapter of [mockApi, http]) {
          const error = await call(adapter).then(
            () => null,
            (e: unknown) => e,
          );
          expect(error).toBeInstanceOf(ApiRequestError);
          expect(error).toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
        }
      }
    });

    it('accepts the same queries with empty fields alike (they never reach the query string)', async () => {
      const empty = { category: 'lips', q: '', limit: undefined, page: undefined };
      const [fromMock, fromHttp] = await Promise.all([mockApi.search(empty), http.search(empty)]);
      expect(fromHttp.total).toBe(6);
      expect(fromMock.total).toBe(fromHttp.total);
      const [mockList, httpList] = await Promise.all([
        mockApi.getProducts(empty),
        http.getProducts(empty),
      ]);
      expect(slugs(httpList.items)).toEqual(slugs(mockList.items));
    });

    it('estimates delivery alike for every product, and from every store to every city', async () => {
      const cases: [string, PkCity][] = [
        ...fixtureProducts.map((p) => [p.slug, 'Karachi'] as [string, PkCity]),
        ...fixtureStores.flatMap((s) => {
          const slug = must(
            fixtureProducts.find((p) => p.seller.id === s.id),
            s.slug,
          ).slug;
          return PK_CITIES.map((c) => [slug, c.name] as [string, PkCity]);
        }),
      ];
      for (const [slug, city] of cases) {
        const [fromMock, fromHttp] = await Promise.all([
          mockApi.getDeliveryEstimate(slug, city),
          http.getDeliveryEstimate(slug, city),
        ]);
        expect(fromMock, `${slug} → ${city}`).not.toBeNull();
        expect(fromHttp, `${slug} → ${city}`).toEqual(fromMock);
      }
      // A product that is not on sale is null in both.
      for (const slug of ['no-such-product', hidden.suspendedSlug]) {
        expect(await http.getDeliveryEstimate(slug, 'Lahore')).toBeNull();
      }
      expect(await mockApi.getDeliveryEstimate('no-such-product', 'Lahore')).toBeNull();
    });
  });
});

import { getApi } from '@hb/sdk';
import { products } from '@hb/sdk/fixtures';
import { DeliveryEstimate, PK_CITIES } from '@hb/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deliveryEstimate, recentlyViewedCards } from '@/app/(shop)/product/[slug]/actions';
import { MAX_RECENT } from '@/lib/recent-store';

/*
 * The product page's server actions (app/(shop)/product/[slug]/actions.ts; the app's unit tests
 * live under components/ and lib/). They run against the mock adapter, as the storefront does by
 * default; the API's side is covered by the API's parity tests.
 */

const api = getApi();
const idOf = (slug: string) => products.find((p) => p.slug === slug)?.id ?? slug;

beforeEach(() => {
  // optional() reports failed requests on stderr; keep the test output clean.
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});
afterEach(() => vi.restoreAllMocks());

describe('deliveryEstimate', () => {
  it('answers with the estimate of the data adapter', async () => {
    for (const city of ['Lahore', 'Gilgit'] as const) {
      const result = await deliveryEstimate('velvet-matte-lipstick', city);
      const expected = await api.getDeliveryEstimate('velvet-matte-lipstick', city);
      expect(result).toEqual({ ok: true, estimate: expected });
      if (result.ok) expect(DeliveryEstimate.parse(result.estimate).city).toBe(city);
    }
  });

  it('validates its arguments before asking the API', async () => {
    const ask = vi.spyOn(api, 'getDeliveryEstimate');
    for (const [slug, city] of [
      ['velvet-matte-lipstick', 'Dubai'],
      ['velvet-matte-lipstick', 'lahore'],
      ['velvet-matte-lipstick', ''],
      ['../admin', 'Lahore'],
      ['a'.repeat(201), 'Lahore'],
      [42, 'Lahore'],
      ['velvet-matte-lipstick', { city: 'Lahore' }],
    ] as const) {
      expect(await deliveryEstimate(slug as string, city as string)).toEqual({ ok: false });
    }
    expect(ask).not.toHaveBeenCalled();
  });

  it('answers "no estimate" for a product that is not on sale, or when the API fails', async () => {
    expect(await deliveryEstimate('no-such-product', 'Lahore')).toEqual({ ok: false });
    vi.spyOn(api, 'getDeliveryEstimate').mockRejectedValueOnce(new Error('API down'));
    expect(await deliveryEstimate('velvet-matte-lipstick', 'Lahore')).toEqual({ ok: false });
    expect(process.stderr.write).toHaveBeenCalledWith(expect.stringContaining('delivery estimate'));
  });

  it('serves every listed city', async () => {
    for (const { name } of PK_CITIES) {
      expect((await deliveryEstimate('gold-kabuki-brush', name)).ok, name).toBe(true);
    }
  });
});

describe('recentlyViewedCards', () => {
  it('returns the cards of the asked ids in the asked order, skipping unknown ones', async () => {
    const slugs = ['silk-lip-oil', 'velvet-matte-lipstick', 'gold-kabuki-brush'];
    const cards = await recentlyViewedCards([
      idOf(slugs[0]!),
      'prd-unknown',
      ...slugs.slice(1).map(idOf),
    ]);
    expect(cards.map((c) => c.slug)).toEqual(slugs);
  });

  it(`takes 1 to ${MAX_RECENT} ids (the carousel's maximum)`, async () => {
    const all = products.map((p) => p.id);
    expect(await recentlyViewedCards(all.slice(0, MAX_RECENT))).toHaveLength(MAX_RECENT);
    const ask = vi.spyOn(api, 'getProducts');
    expect(await recentlyViewedCards(all.slice(0, MAX_RECENT + 1))).toEqual([]);
    expect(await recentlyViewedCards([])).toEqual([]);
    expect(await recentlyViewedCards(['', 'prd-1'])).toEqual([]);
    expect(await recentlyViewedCards(['x'.repeat(101)])).toEqual([]);
    expect(await recentlyViewedCards('prd-1' as unknown as string[])).toEqual([]);
    expect(await recentlyViewedCards([1, 2] as unknown as string[])).toEqual([]);
    expect(ask).not.toHaveBeenCalled();
  });

  it('returns no cards when the API fails', async () => {
    vi.spyOn(api, 'getProducts').mockRejectedValueOnce(new Error('API down'));
    expect(await recentlyViewedCards(['prd-1'])).toEqual([]);
  });
});

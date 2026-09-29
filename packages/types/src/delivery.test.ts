import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SHIPPING_PROFILE,
  DeliveryEstimate,
  deliveryZone,
  estimateDelivery,
  FALLBACK_COURIER_DAYS,
  findPkCity,
  PK_CITIES,
  PkCity,
  ShippingProfile,
  type DeliveryZone,
  type ShippingRateBand,
} from './delivery';

describe('PK_CITIES', () => {
  it('lists each city once, with its province', () => {
    const names = PK_CITIES.map((c) => c.name);
    expect(names).toHaveLength(24);
    expect(new Set(names).size).toBe(names.length);
    expect(PkCity.options).toEqual(names);
    expect(findPkCity(' islamabad ')?.province).toBe('islamabad');
    expect(findPkCity('Atlantis')).toBeUndefined();
  });

  it('marks the far courier destinations as remote', () => {
    const remote = PK_CITIES.filter((c) => 'remote' in c && c.remote).map((c) => c.name);
    expect(remote).toEqual(['Gwadar', 'Turbat', 'Gilgit', 'Skardu']);
  });

  it('accepts only listed cities', () => {
    expect(PkCity.safeParse('Lahore').success).toBe(true);
    expect(PkCity.safeParse('lahore').success).toBe(false);
    expect(PkCity.safeParse('Dubai').success).toBe(false);
  });
});

describe('deliveryZone', () => {
  const cases: [string, PkCity, DeliveryZone][] = [
    // Same city, and Islamabad–Rawalpindi as one city, both ways.
    ['Lahore', 'Lahore', 'same_city'],
    ['Karachi', 'Karachi', 'same_city'],
    ['Islamabad', 'Rawalpindi', 'same_city'],
    ['Rawalpindi', 'Islamabad', 'same_city'],
    ['Islamabad', 'Islamabad', 'same_city'],
    // A seller in a remote city delivering in its own city.
    ['Gilgit', 'Gilgit', 'same_city'],
    // Same province; Islamabad counts as Punjab.
    ['Lahore', 'Multan', 'province'],
    ['Lahore', 'Islamabad', 'province'],
    ['Islamabad', 'Faisalabad', 'province'],
    ['Karachi', 'Hyderabad', 'province'],
    ['Peshawar', 'Abbottabad', 'province'],
    ['Muzaffarabad', 'Mirpur', 'province'],
    // Remote destinations win over the same province.
    ['Quetta', 'Gwadar', 'remote'],
    ['Lahore', 'Gilgit', 'remote'],
    ['Gilgit', 'Skardu', 'remote'],
    ['Karachi', 'Turbat', 'remote'],
    // Everything else.
    ['Lahore', 'Karachi', 'nationwide'],
    ['Peshawar', 'Islamabad', 'nationwide'],
    ['Karachi', 'Quetta', 'nationwide'],
    ['Gwadar', 'Quetta', 'province'],
  ];

  it.each(cases)('%s → %s is %s', (from, to, zone) => {
    expect(deliveryZone(from, to)).toBe(zone);
  });

  it('ignores case and spaces in the seller city', () => {
    expect(deliveryZone('  lahore ', 'Lahore')).toBe('same_city');
    expect(deliveryZone('RAWALPINDI', 'Islamabad')).toBe('same_city');
  });

  it('treats an unknown seller city as nationwide, or remote for a remote destination', () => {
    expect(deliveryZone('Atlantis', 'Lahore')).toBe('nationwide');
    expect(deliveryZone('', 'Karachi')).toBe('nationwide');
    expect(deliveryZone('Atlantis', 'Skardu')).toBe('remote');
  });
});

describe('estimateDelivery', () => {
  const band = (
    zone: DeliveryZone,
    price: number,
    daysMin: number,
    daysMax: number,
    minWeightG = 0,
    maxWeightG = 1000,
  ): ShippingRateBand => ({ zone, minWeightG, maxWeightG, price, daysMin, daysMax });

  const profile = ShippingProfile.parse({
    handlingDays: 2,
    freeShippingMin: 300_000,
    codEnabled: true,
    rates: [
      band('same_city', 30_000, 1, 2, 1000, 5000),
      band('same_city', 15_000, 1, 1),
      band('province', 20_000, 2, 3),
      band('nationwide', 25_000, 3, 5),
    ],
  });

  it('adds handling days to the lightest band of the zone', () => {
    const e = estimateDelivery('Lahore', 'Lahore', profile);
    expect(DeliveryEstimate.parse(e)).toEqual({
      city: 'Lahore',
      zone: 'same_city',
      daysMin: 3,
      daysMax: 3,
      fee: 15_000,
      freeShippingMin: 300_000,
      codAvailable: true,
    });
    expect(estimateDelivery('Lahore', 'Multan', profile)).toMatchObject({
      zone: 'province',
      daysMin: 4,
      daysMax: 5,
      fee: 20_000,
    });
    expect(estimateDelivery('Lahore', 'Karachi', profile)).toMatchObject({
      zone: 'nationwide',
      daysMin: 5,
      daysMax: 7,
      fee: 25_000,
    });
  });

  it('leaves the fee to checkout without a rate for the zone, with nationwide days', () => {
    expect(estimateDelivery('Lahore', 'Skardu', profile)).toEqual({
      city: 'Skardu',
      zone: 'remote',
      daysMin: 5,
      daysMax: 7,
      fee: null,
      freeShippingMin: 300_000,
      codAvailable: true,
    });
  });

  it('falls back to the default courier days without a nationwide rate either', () => {
    const e = estimateDelivery('Lahore', 'Karachi', { ...profile, rates: [] });
    expect(e).toMatchObject({
      fee: null,
      daysMin: 2 + FALLBACK_COURIER_DAYS.min,
      daysMax: 2 + FALLBACK_COURIER_DAYS.max,
    });
  });

  it('uses the column defaults for a seller without shipping settings', () => {
    expect(estimateDelivery('Atlantis', 'Gilgit')).toEqual({
      city: 'Gilgit',
      zone: 'remote',
      daysMin: DEFAULT_SHIPPING_PROFILE.handlingDays + FALLBACK_COURIER_DAYS.min,
      daysMax: DEFAULT_SHIPPING_PROFILE.handlingDays + FALLBACK_COURIER_DAYS.max,
      fee: null,
      freeShippingMin: null,
      codAvailable: true,
    });
  });

  it('reports cash on delivery from the settings', () => {
    const e = estimateDelivery('Lahore', 'Lahore', { ...profile, codEnabled: false });
    expect(e.codAvailable).toBe(false);
  });
});

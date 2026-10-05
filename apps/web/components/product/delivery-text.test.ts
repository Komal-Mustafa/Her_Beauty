import { PK_CITIES, Province, type DeliveryEstimate } from '@hb/types';
import { describe, expect, it } from 'vitest';
import { CITY_GROUPS, deliveryDays, deliveryLine, PROVINCE_LABEL } from './delivery-text';

const estimate = (over: Partial<DeliveryEstimate> = {}): DeliveryEstimate => ({
  city: 'Lahore',
  zone: 'province',
  daysMin: 2,
  daysMax: 4,
  fee: 25_000,
  freeShippingMin: 300_000,
  codAvailable: true,
  ...over,
});

describe('CITY_GROUPS', () => {
  it('lists every city once, grouped by province in the list’s order', () => {
    expect(CITY_GROUPS.flatMap((g) => g.cities)).toEqual(PK_CITIES.map((c) => c.name));
    expect(CITY_GROUPS.map((g) => g.label)).toEqual([
      'Punjab',
      'Islamabad Capital Territory',
      'Sindh',
      'Khyber Pakhtunkhwa',
      'Balochistan',
      'Gilgit-Baltistan',
      'Azad Jammu and Kashmir',
    ]);
    for (const group of CITY_GROUPS) {
      const listed = PK_CITIES.filter((c) => c.province === group.province);
      expect(group.cities).toEqual(listed.map((c) => c.name));
    }
  });

  it('has a readable name for every province', () => {
    for (const province of Province.options) expect(PROVINCE_LABEL[province]).toMatch(/^[A-Z]/);
  });
});

describe('deliveryLine', () => {
  it('reads days, fee, free-shipping minimum and cash on delivery (paisa → rupees)', () => {
    expect(deliveryLine(estimate())).toBe(
      '2–4 days · Rs 250 · free over Rs 3,000 · Cash on delivery available',
    );
  });

  it('leaves the fee to checkout when the seller has no rate for the zone', () => {
    expect(deliveryLine(estimate({ fee: null, daysMin: 4, daysMax: 7 }))).toBe(
      '4–7 days · Delivery fee confirmed at checkout · free over Rs 3,000 · Cash on delivery available',
    );
  });

  it('drops what the seller does not offer', () => {
    expect(deliveryLine(estimate({ freeShippingMin: null, codAvailable: false }))).toBe(
      '2–4 days · Rs 250 · No cash on delivery',
    );
    expect(deliveryLine(estimate({ fee: 0 }))).toBe(
      '2–4 days · Free delivery · Cash on delivery available',
    );
  });

  it('says one day without a range', () => {
    expect(deliveryDays(estimate({ daysMin: 1, daysMax: 1 }))).toBe('1 day');
    expect(deliveryDays(estimate({ daysMin: 3, daysMax: 3 }))).toBe('3 days');
  });
});

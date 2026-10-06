import { describe, expect, it } from 'vitest';
import { discountPercent as sortKey } from '@hb/types';
import { discountPercent, formatMoney, rupees } from './format';

describe('formatMoney', () => {
  it('formats whole rupees without decimals', () => {
    expect(formatMoney(rupees(3000))).toBe('Rs 3,000');
  });
  it('keeps paisa when present', () => {
    expect(formatMoney(149950)).toBe('Rs 1,499.50');
  });
  it('formats large amounts with grouping', () => {
    expect(formatMoney(rupees(200000))).toBe('Rs 200,000');
  });
});

describe('rupees', () => {
  it('returns integer paisa', () => {
    expect(rupees(12.34)).toBe(1234);
    expect(Number.isInteger(rupees(0.1 + 0.2))).toBe(true);
  });
});

describe('discountPercent', () => {
  it('returns null without a higher compare-at price', () => {
    expect(discountPercent(1000, null)).toBeNull();
    expect(discountPercent(1000, 1000)).toBeNull();
  });
  it('rounds the discount down, like the Biggest discount sort', () => {
    expect(discountPercent(rupees(2250), rupees(3000))).toBe(25);
    expect(discountPercent(rupees(1850), rupees(2200))).toBe(15); // 15.9 %
    expect(discountPercent(rupees(1990), rupees(2350))).toBe(15); // 15.3 %
  });
  it('shows no badge for less than 1% off', () => {
    expect(discountPercent(rupees(995), rupees(1000))).toBeNull();
    expect(discountPercent(rupees(990), rupees(1000))).toBe(1);
  });
  it('agrees with the sort key for every on-sale price', () => {
    for (let price = 1; price < 400; price++) {
      expect(discountPercent(price, 400)).toBe(sortKey(price, 400) || null);
    }
  });
});

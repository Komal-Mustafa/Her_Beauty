import { describe, expect, it } from 'vitest';
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
  it('rounds the discount', () => {
    expect(discountPercent(rupees(2250), rupees(3000))).toBe(25);
  });
});

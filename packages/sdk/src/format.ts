import type { Currency, Money } from '@hb/types';

const MINOR_UNITS: Record<Currency, number> = { PKR: 100, USD: 100 };

/** Format integer minor units (paisa) for display. Only place money becomes a decimal. */
export function formatMoney(amount: Money, currency: Currency = 'PKR'): string {
  const major = amount / MINOR_UNITS[currency];
  const hasFraction = amount % MINOR_UNITS[currency] !== 0;
  const formatted = new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(major);
  return currency === 'PKR' ? `Rs ${formatted}` : `$${formatted}`;
}

/** Convert whole rupees to paisa for fixtures and tests. */
export const rupees = (value: number): Money => Math.round(value * 100);

export function discountPercent(price: Money, compareAt: Money | null): number | null {
  if (compareAt === null || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

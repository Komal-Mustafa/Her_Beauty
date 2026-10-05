// Dependency-free (no zod), so client code can import it alone through `@hb/types/money`: the
// "-n%" sale badge (@hb/sdk/format) and the "Biggest discount" sort (search.ts) share this rule.

/** Whole percent off, rounded down; 0 when there is no higher compare-at price. */
export function discountPercent(price: number, compareAt: number | null): number {
  if (compareAt === null || compareAt <= price) return 0;
  return Math.floor(((compareAt - price) * 100) / compareAt);
}

import type { Product, Variant } from '@hb/types';

/*
 * Which variant the buy box shows and what the shopper may do with it (docs/p5-catalog.md §5
 * "Buy box", "Variant from the URL"). Pure, so the rules are unit-tested.
 */

/** At or below this many left, the buy box says "Only n left". */
export const LOW_STOCK = 5;
/**
 * Most of one item per order: the cart's MAX_QTY (a test keeps them equal). Not imported, because
 * the server page uses this module and the cart store is client-only (React hooks).
 */
export const MAX_QTY_PER_ITEM = 10;

/** How the variants differ: by shade (swatches), by size (pills), or not at all. */
export type OptionKind = 'shade' | 'size' | 'none';

/** URL form of a shade name for `?shade=`: "Berry Kiss" → "berry-kiss", "Rosé & Co" → "rose-and-co". */
export function shadeSlug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function optionKind(variants: readonly Variant[]): OptionKind {
  if (variants.some((v) => v.shadeName)) return 'shade';
  const sizes = new Set(variants.map((v) => v.sizeLabel).filter(Boolean));
  return sizes.size > 1 ? 'size' : 'none';
}

export function variantByShadeSlug(
  variants: readonly Variant[],
  slug: string,
): Variant | undefined {
  const wanted = shadeSlug(slug);
  if (!wanted) return undefined;
  return variants.find((v) => v.shadeName && shadeSlug(v.shadeName) === wanted);
}

/**
 * The variant on first render: the one named by `?shade=` (even when sold out, so a shared link
 * shows what was shared), else the first in stock, else the first.
 */
export function initialVariant(product: Product, shadeParam?: string | string[]): Variant {
  const param = Array.isArray(shadeParam) ? shadeParam[0] : shadeParam;
  const fromUrl = param ? variantByShadeSlug(product.variants, param.slice(0, 100)) : undefined;
  // `variants` has at least one entry (schema `.min(1)`).
  return fromUrl ?? product.variants.find((v) => v.stock > 0) ?? product.variants[0]!;
}

/** What the variant is called in the buy box, cart and toasts ("Berry Kiss", "50 ml"). */
export function variantLabel(variant: Variant, kind: OptionKind): string | null {
  if (kind === 'shade') return variant.shadeName;
  if (kind === 'size') return variant.sizeLabel;
  return null;
}

/** The cart line title: the product plus the chosen shade or size (at most 200 characters). */
export function cartTitle(product: Product, variant: Variant, kind: OptionKind): string {
  const label = variantLabel(variant, kind);
  return (label ? `${product.title}, ${label}` : product.title).slice(0, 200);
}

export type StockNote = { tone: 'warning' | 'danger'; text: string };

export function stockNote(stock: number): StockNote | null {
  if (stock <= 0) return { tone: 'danger', text: 'Out of stock' };
  if (stock <= LOW_STOCK) return { tone: 'warning', text: `Only ${stock} left` };
  return null;
}

/** Most the shopper can add at once: 1…10, never more than is in stock; 0 when sold out. */
export function maxQuantity(stock: number): number {
  return Math.max(0, Math.min(MAX_QTY_PER_ITEM, Math.trunc(stock)));
}

/** A typed or stepped quantity kept within 1…max (1 when nothing can be added). */
export function clampQuantity(qty: number, max: number): number {
  if (!Number.isFinite(qty)) return 1;
  return Math.max(1, Math.min(Math.max(1, max), Math.trunc(qty)));
}

import { describe, expect, it } from 'vitest';
import { MAX_QTY } from '@/lib/cart-store';
import { lipOil, lipstick, perfume } from './test-product';
import {
  addableQuantity,
  cartTitle,
  clampQuantity,
  initialVariant,
  MAX_QTY_PER_ITEM,
  maxQuantity,
  optionKind,
  shadeSlug,
  stockNote,
  variantByShadeSlug,
} from './variant-selection';

describe('shadeSlug', () => {
  it.each([
    ['Berry Kiss', 'berry-kiss'],
    ['  Nude   Silk ', 'nude-silk'],
    ['Rosé Lumière', 'rose-lumiere'],
    ['Rose & Gold', 'rose-and-gold'],
    ['No. 5 / Red', 'no-5-red'],
  ])('%j → %j', (name, slug) => {
    expect(shadeSlug(name)).toBe(slug);
  });
});

describe('optionKind', () => {
  it('tells shades, sizes and single variants apart', () => {
    expect(optionKind(lipstick().variants)).toBe('shade');
    expect(optionKind(perfume().variants)).toBe('size');
    expect(optionKind(lipOil().variants)).toBe('none');
  });

  it('prefers shades when variants differ by both', () => {
    const variants = lipstick().variants.map((v, i) => ({ ...v, sizeLabel: `${i + 1} g` }));
    expect(optionKind(variants)).toBe('shade');
  });

  it('ignores a size every variant shares', () => {
    const variants = perfume().variants.map((v) => ({ ...v, sizeLabel: '50 ml' }));
    expect(optionKind(variants)).toBe('none');
  });
});

describe('initialVariant', () => {
  const product = lipstick();

  it('picks the shade named in the URL, in any spelling', () => {
    expect(initialVariant(product, 'rose-petal').shadeName).toBe('Rose Petal');
    expect(initialVariant(product, 'Rose Petal').shadeName).toBe('Rose Petal');
    expect(initialVariant(product, ['nude-silk', 'berry-kiss']).shadeName).toBe('Nude Silk');
  });

  it('shows a shared sold-out shade as it is', () => {
    expect(initialVariant(product, 'nude-silk').stock).toBe(0);
  });

  it('falls back to the first shade in stock', () => {
    expect(initialVariant(product, 'no-such-shade').shadeName).toBe('Berry Kiss');
    expect(initialVariant(product).shadeName).toBe('Berry Kiss');
    const firstSoldOut = {
      ...product,
      variants: product.variants.map((v, i) => ({ ...v, stock: i === 0 ? 0 : 5 })),
    };
    expect(initialVariant(firstSoldOut).shadeName).toBe('Rose Petal');
  });

  it('falls back to the first variant when nothing is in stock', () => {
    const soldOut = { ...product, variants: product.variants.map((v) => ({ ...v, stock: 0 })) };
    expect(initialVariant(soldOut).shadeName).toBe('Berry Kiss');
  });

  it('never matches an empty slug', () => {
    expect(variantByShadeSlug(product.variants, '---')).toBeUndefined();
  });
});

describe('cartTitle', () => {
  it('names the shade or size, not a lone variant', () => {
    const lip = lipstick();
    expect(cartTitle(lip, lip.variants[1]!, 'shade')).toBe('Velvet Matte Lipstick, Rose Petal');
    const bottle = perfume();
    expect(cartTitle(bottle, bottle.variants[1]!, 'size')).toBe(
      'Damask Rose Eau de Parfum, 100 ml',
    );
    const oil = lipOil();
    expect(cartTitle(oil, oil.variants[0]!, 'none')).toBe('Silk Lip Oil');
  });

  it('stays within the cart limit', () => {
    const lip = lipstick({ title: 'x'.repeat(250) });
    expect(cartTitle(lip, lip.variants[0]!, 'shade')).toHaveLength(200);
  });
});

describe('stock and quantity', () => {
  it('says "Only n left" at five or fewer and "Out of stock" at none', () => {
    expect(stockNote(25)).toBeNull();
    expect(stockNote(6)).toBeNull();
    expect(stockNote(5)).toEqual({ tone: 'warning', text: 'Only 5 left' });
    expect(stockNote(1)).toEqual({ tone: 'warning', text: 'Only 1 left' });
    expect(stockNote(0)).toEqual({ tone: 'danger', text: 'Out of stock' });
  });

  it('caps the quantity at ten and at the stock', () => {
    expect(MAX_QTY_PER_ITEM).toBe(MAX_QTY);
    expect(maxQuantity(25)).toBe(10);
    expect(maxQuantity(3)).toBe(3);
    expect(maxQuantity(0)).toBe(0);
  });

  it('adds no more than the limit leaves room for next to what the cart holds', () => {
    expect(addableQuantity(4, 25, 0)).toBe(4);
    expect(addableQuantity(4, 25, 8)).toBe(2);
    expect(addableQuantity(1, 25, 10)).toBe(0);
    expect(addableQuantity(3, 3, 2)).toBe(1);
    expect(addableQuantity(1, 3, 3)).toBe(0);
    // A line above today's stock (it sold since) leaves nothing to add, never a negative.
    expect(addableQuantity(2, 2, 5)).toBe(0);
    expect(addableQuantity(1, 0, 0)).toBe(0);
  });

  it('keeps a quantity within 1…max', () => {
    expect(clampQuantity(4, 3)).toBe(3);
    expect(clampQuantity(0, 3)).toBe(1);
    expect(clampQuantity(-2, 10)).toBe(1);
    expect(clampQuantity(2.7, 10)).toBe(2);
    expect(clampQuantity(Number.NaN, 10)).toBe(1);
    expect(clampQuantity(5, 0)).toBe(1);
  });
});

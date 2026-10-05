'use client';

import { Badge, Button, Price, Rating, ShadePicker, type Shade } from '@hb/ui';
import { ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useProduct } from './product-context';
import { QuantityStepper } from './quantity-stepper';
import { SizePills } from './size-pills';
import { fixedSize, maxQuantity, soldOut, stockNote } from './variant-selection';
import { WishlistButton } from './wishlist-button';

/** A shade without a hex still gets a neutral swatch (a theme colour, not a raw hex). */
const NO_HEX = 'var(--color-ink-200)';

/**
 * The buy box (docs/p5-catalog.md §5): brand, title, rating, price, shade or size, stock,
 * quantity, Add to cart and the wishlist heart. `children` (seller card, trust strip) are
 * rendered on the server and sit at the bottom.
 */
export function BuyBox({ children }: { children?: ReactNode }) {
  const { product, kind, variant, selectVariant, qty, setQty, add, mainAddRef } = useProduct();
  const outOfStock = variant.stock <= 0;
  const note = stockNote(variant.stock);
  const size = fixedSize(variant, kind);

  const shades: Shade[] = product.variants
    .filter((v) => v.shadeName)
    .map((v) => ({ name: v.shadeName ?? '', hex: v.shadeHex ?? NO_HEX, soldOut: v.stock <= 0 }));

  const picker =
    kind === 'shade' && shades.length > 0 ? (
      <ShadePicker
        shades={shades}
        value={variant.shadeName ?? ''}
        onChange={(name) => {
          const next = product.variants.find((v) => v.shadeName === name);
          if (next) selectVariant(next.id);
        }}
      />
    ) : kind === 'size' ? (
      <SizePills variants={product.variants} value={variant.id} onChange={selectVariant} />
    ) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/brand/${product.brand.slug}`}
          className="eyebrow inline-flex min-h-11 items-center text-gold-800 underline-offset-4 hover:underline"
        >
          {product.brand.name}
        </Link>
        <h1 className="font-display text-[34px] font-semibold leading-tight text-ink-900 lg:text-[44px]">
          {product.title}
        </h1>
        <a
          href="#reviews"
          className="mt-1 inline-flex min-h-11 flex-wrap items-center gap-x-2 text-sm text-ink-500 underline-offset-4 hover:text-pink-700 hover:underline"
        >
          {product.ratingCount > 0 ? (
            <>
              <Rating value={product.rating} />
              <span>{product.ratingCount.toLocaleString('en-PK')} ratings</span>
            </>
          ) : (
            <span>No ratings yet</span>
          )}
        </a>
      </div>

      <div className="flex flex-col items-start gap-1">
        <Price
          amount={variant.price}
          compareAt={variant.compareAtPrice}
          currency={variant.currency}
          size="lg"
        />
        {/* One pack size for every variant: no pills, but the shopper still sees what she buys. */}
        {size ? (
          <p className="text-sm text-ink-500">
            Size: <span className="text-ink-900">{size}</span>
          </p>
        ) : null}
      </div>

      {picker || note ? (
        <div>
          {picker}
          {/*
           * With a picker, always in the DOM so a change of variant is announced; takes no room
           * when empty. Without one the variant cannot change, and a product with neither a
           * picker nor a note renders nothing here (an empty block would double the gap).
           */}
          <div aria-live="polite" className="[&:not(:empty)]:mt-3 first:[&:not(:empty)]:mt-0">
            {note ? <Badge kind={note.tone}>{note.text}</Badge> : null}
          </div>
        </div>
      ) : null}

      {/* Nothing to count when no variant can be bought; a sold-out shade keeps it (disabled). */}
      {soldOut(product) ? null : (
        <QuantityStepper value={qty} max={maxQuantity(variant.stock)} onChange={setQty} />
      )}

      {outOfStock ? (
        <div className="grid gap-3">
          <Button ref={mainAddRef} disabled block>
            Out of stock
          </Button>
          <WishlistButton
            variant="block"
            productId={product.id}
            productSlug={product.slug}
            title={product.title}
          />
        </div>
      ) : (
        <div className="flex gap-3">
          <Button ref={mainAddRef} block onClick={(e) => add(e.currentTarget)} className="flex-1">
            <ShoppingBag aria-hidden className="h-5 w-5" />
            Add to cart
          </Button>
          <WishlistButton productId={product.id} productSlug={product.slug} title={product.title} />
        </div>
      )}

      {children}
    </div>
  );
}

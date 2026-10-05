'use client';

import { COLORS_3D } from '@hb/three';
import type { Product, Variant } from '@hb/types';
import { useToast } from '@hb/ui';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { addToCart, useCart } from '@/lib/cart-store';
import { flyToCart } from '@/lib/fly-to-cart';
import { cartToast, itemLimitText } from './cart-toast';
import {
  addableQuantity,
  cartTitle,
  clampQuantity,
  maxQuantity,
  optionKind,
  shadeSlug,
  type OptionKind,
} from './variant-selection';

type ProductState = {
  product: Product;
  kind: OptionKind;
  variant: Variant;
  selectVariant: (variantId: string) => void;
  /** Colour for the 3D viewer: the chosen shade, else the product's first, else soft pink. */
  shadeHex: string;
  qty: number;
  setQty: (qty: number) => void;
  /** Adds the chosen variant; `from` is the pressed button (the flight's fallback start). */
  add: (from: HTMLElement | null) => void;
  /** The buy box's Add to cart, watched by the sticky bar. */
  mainAddRef: RefObject<HTMLButtonElement | null>;
  /** The gallery image on show, where the fly-to-cart copy starts. */
  galleryImageRef: RefObject<HTMLElement | null>;
};

const ProductContext = createContext<ProductState | null>(null);

type ProductProviderProps = {
  product: Product;
  /** Chosen on the server from `?shade=` (see `initialVariant`). */
  initialVariantId: string;
  children: ReactNode;
};

/**
 * The product page's shared selection (docs/p5-catalog.md §5): variant and quantity, read by the
 * gallery (3D shade), the buy box and the sticky buy bar. A shade change is written to `?shade=`
 * with `history.replaceState`, so the link can be shared without adding history entries.
 */
export function ProductProvider({ product, initialVariantId, children }: ProductProviderProps) {
  const toast = useToast();
  const cart = useCart();
  const kind = optionKind(product.variants);
  const [variantId, setVariantId] = useState(initialVariantId);
  const [qty, setQtyState] = useState(1);
  const mainAddRef = useRef<HTMLButtonElement>(null);
  const galleryImageRef = useRef<HTMLElement>(null);

  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0]!;
  const max = maxQuantity(variant.stock);

  const selectVariant = useCallback(
    (id: string) => {
      const next = product.variants.find((v) => v.id === id);
      if (!next) return;
      setVariantId(id);
      setQtyState((q) => clampQuantity(q, maxQuantity(next.stock)));
      if (kind === 'shade' && next.shadeName) {
        const url = new URL(window.location.href);
        url.searchParams.set('shade', shadeSlug(next.shadeName));
        window.history.replaceState(window.history.state, '', url);
      }
    },
    [product.variants, kind],
  );

  const setQty = useCallback((n: number) => setQtyState(clampQuantity(n, max)), [max]);

  const add = useCallback(
    (from: HTMLElement | null) => {
      const image = product.images[0];
      if (variant.stock <= 0 || !image) return;
      const title = cartTitle(product, variant, kind);
      // The 1…min(10, stock) limit counts what is already in the cart, and the toast names what
      // was actually added (docs/p5-catalog.md §5 "Buy box").
      const inCart = cart.find((l) => l.variantId === variant.id)?.qty ?? 0;
      const n = addableQuantity(qty, variant.stock, inCart);
      const result =
        n > 0
          ? addToCart({
              variantId: variant.id,
              productSlug: product.slug,
              title,
              image: image.url,
              unitPrice: variant.price,
              qty: n,
            })
          : 'max-qty';
      const added = n > 1 ? `${n} × ${title}` : title;
      toast.show(
        cartToast(result, n < qty ? `${added}. ${itemLimitText(variant.stock)}` : added, {
          whenInvalid: 'Please refresh the page and try again.',
          stock: variant.stock,
        }),
      );
      if (result !== 'added') return;
      const shown = galleryImageRef.current?.querySelector('img') ?? null;
      flyToCart({
        imageSrc: shown?.currentSrc || shown?.getAttribute('src') || image.url,
        from: [shown, from],
      });
    },
    [product, variant, kind, qty, cart, toast],
  );

  const shadeHex = variant.shadeHex ?? product.shades[0]?.hex ?? COLORS_3D.pinkSoft;

  const value = useMemo<ProductState>(
    () => ({
      product,
      kind,
      variant,
      selectVariant,
      shadeHex,
      qty,
      setQty,
      add,
      mainAddRef,
      galleryImageRef,
    }),
    [product, kind, variant, selectVariant, shadeHex, qty, setQty, add],
  );

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
}

export function useProduct(): ProductState {
  const ctx = useContext(ProductContext);
  if (!ctx) throw new Error('useProduct must be used inside <ProductProvider>');
  return ctx;
}

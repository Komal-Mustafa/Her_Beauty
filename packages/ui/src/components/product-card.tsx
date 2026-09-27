'use client';

import type { ProductCard as ProductCardData } from '@hb/types';
import { Heart, ShoppingBag } from 'lucide-react';
import { useRef, type ComponentType, type ReactNode } from 'react';
import { prefersReducedMotion } from '../hooks/use-reduced-motion';
import { cn } from '../lib/cn';
import { DURATION, EASE_SOFT_CSS } from '../motion';
import { Badge } from './badge';
import { Price } from './price';
import { Rating } from './rating';

/** What the card needs from a link component (next/link's `Link` fits). */
export type ProductCardLinkProps = { href: string; className?: string; children: ReactNode };

/** What the card needs from an image component (the app passes a next/image `fill` wrapper). */
export type ProductCardImageProps = {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
};

type ProductCardProps = {
  product: ProductCardData;
  /** Product page URL (default `/product/{slug}`). */
  href?: string;
  linkAs?: ComponentType<ProductCardLinkProps>;
  imageAs?: ComponentType<ProductCardImageProps>;
  /** `sizes` for the image (the card is ~50vw on phones, a quarter of the grid on desktop). */
  sizes?: string;
  priority?: boolean;
  headingLevel?: 'h2' | 'h3' | 'h4';
  wishlisted?: boolean;
  /** Shows the wishlist heart. */
  onToggleWishlist?: (product: ProductCardData) => void;
  /** One-click add, used only when the product has a `quickAddVariantId`. */
  onAddToCart?: (product: ProductCardData) => void;
  adding?: boolean;
  className?: string;
};

const MAX_DOTS = 5;
const BURST_DOTS = 6;
const DEFAULT_SIZES = '(min-width: 1280px) 300px, (min-width: 768px) 33vw, 50vw';

function DefaultLink({ href, className, children }: ProductCardLinkProps) {
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

function DefaultImage({ src, alt, className, priority }: ProductCardImageProps) {
  return (
    // Fallback for non-Next hosts (tests, Storybook); apps pass next/image via `imageAs`.
    <img
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className={cn('absolute inset-0 h-full w-full', className)}
    />
  );
}

/**
 * Product card (04-ui-ux §5, docs/p4-home.md §4). Presentational: the app wires the cart and the
 * wishlist through `onAddToCart` / `onToggleWishlist` / `wishlisted` / `adding`.
 *
 * The whole card is one link (the title link's `::after` covers it); the heart and the cart
 * action sit above that layer. On hover: lift + shadow, image zoom 1.04 with a crossfade to the
 * second image, shade dots and the action slide up. Devices without hover always show the action
 * under the price instead. Reduced motion keeps the fades and drops every movement.
 */
export function ProductCard({
  product,
  href = `/product/${product.slug}`,
  linkAs: Link = DefaultLink,
  imageAs: Img = DefaultImage,
  sizes = DEFAULT_SIZES,
  priority = false,
  headingLevel: Heading = 'h3',
  wishlisted = false,
  onToggleWishlist,
  onAddToCart,
  adding = false,
  className,
}: ProductCardProps) {
  const [primary, secondary] = product.images;
  const quickAdd = product.quickAddVariantId !== null && onAddToCart !== undefined;
  const optionsLabel = product.shades.length > 1 ? 'Choose shade' : 'See options';

  const action = (placement: 'overlay' | 'inline') => {
    const base = cn(
      'relative z-[2] h-11 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-btn px-2 text-sm font-medium transition duration-fast ease-soft active:scale-[0.98] motion-reduce:active:scale-100',
      // Exactly one of the two copies is displayed, so assistive tech only ever meets one.
      placement === 'overlay'
        ? 'pointer-events-auto hidden [@media(hover:hover)]:inline-flex'
        : 'inline-flex',
    );
    if (quickAdd) {
      return (
        <button
          type="button"
          onClick={() => onAddToCart?.(product)}
          disabled={adding}
          aria-busy={adding || undefined}
          className={cn(
            base,
            'bg-pink-600 text-white shadow-soft hover:bg-pink-700 disabled:opacity-70',
          )}
        >
          <ShoppingBag aria-hidden className="h-4 w-4" />
          {adding ? 'Adding…' : 'Add to cart'}
          <span className="sr-only">: {product.title}</span>
        </button>
      );
    }
    return (
      <Link
        href={href}
        className={cn(base, 'border border-pink-600 bg-white text-pink-600 hover:bg-pink-100')}
      >
        {optionsLabel}
        <span className="sr-only">: {product.title}</span>
      </Link>
    );
  };

  return (
    <article
      className={cn(
        'group/card relative flex h-full flex-col rounded-card border border-ink-200 bg-white transition duration-base ease-soft',
        'hover:-translate-y-1 has-focus-visible:-translate-y-1 motion-reduce:hover:translate-y-0 motion-reduce:has-focus-visible:translate-y-0',
        // Shadow lives on a pseudo-element so only its opacity animates.
        'before:pointer-events-none before:absolute before:inset-0 before:rounded-card before:opacity-0 before:shadow-lift before:transition-opacity before:duration-base before:ease-soft hover:before:opacity-100 has-focus-visible:before:opacity-100',
        className,
      )}
    >
      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:p-4">
        {/* Wraps on narrow cards so neither the brand nor Sponsored gets cut. */}
        <div className="flex min-h-5 flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <p className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-800">
            {product.brand.name}
          </p>
          {product.sponsored && <Badge kind="sponsored" className="shrink-0 px-2" />}
        </div>
        <Heading className="min-h-[2lh] font-sans text-sm font-medium leading-snug text-ink-900 md:text-[15px]">
          <Link
            href={href}
            className={cn(
              'line-clamp-2 transition-colors duration-fast hover:text-pink-700',
              // Stretched link: the whole card is the link target.
              "after:absolute after:inset-0 after:z-[1] after:rounded-card after:content-['']",
              'focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-pink-400',
            )}
          >
            {product.title}
          </Link>
        </Heading>
        <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-ink-500">
          <span className="min-w-0 truncate">{product.seller.storeName}</span>
          {product.seller.badge === 'official_brand' ? (
            <Badge kind="official" className="shrink-0 px-2">
              Official
            </Badge>
          ) : (
            <Badge kind="verified" className="shrink-0 px-2">
              Verified
            </Badge>
          )}
        </p>
        {product.ratingCount > 0 && (
          <Rating value={product.rating} count={product.ratingCount} compact className="text-xs" />
        )}
        <Price
          amount={product.price}
          compareAt={product.compareAtPrice}
          currency={product.currency}
          size="sm"
          className="gap-x-1.5 gap-y-0"
        />
        <div className="mt-auto pt-2 [@media(hover:hover)]:hidden">{action('inline')}</div>
      </div>

      <div className="relative order-first aspect-[4/5] overflow-hidden rounded-t-[calc(var(--radius-card)-1px)] bg-blush-50">
        {primary && (
          <Img
            src={primary.url}
            alt={primary.alt}
            sizes={sizes}
            priority={priority}
            className="object-cover transition duration-slow ease-soft group-hover/card:scale-[1.04] motion-reduce:group-hover/card:scale-100"
          />
        )}
        {secondary && (
          // Hover-only crossfade; display:none on touch so the lazy image is never fetched there.
          <span aria-hidden className="absolute inset-0 hidden [@media(hover:hover)]:block">
            <Img
              src={secondary.url}
              alt=""
              sizes={sizes}
              className="object-cover opacity-0 transition duration-slow ease-soft group-hover/card:scale-[1.04] group-hover/card:opacity-100 motion-reduce:group-hover/card:scale-100"
            />
          </span>
        )}

        {(product.has3d || product.isNew) && (
          <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5 sm:left-3 sm:top-3">
            {product.has3d && <Badge kind="threeD" className="px-2" />}
            {product.isNew && <Badge kind="new" className="px-2" />}
          </div>
        )}

        {onToggleWishlist && (
          <WishlistButton
            pressed={wishlisted}
            title={product.title}
            onToggle={() => onToggleWishlist(product)}
          />
        )}

        <div
          className={cn(
            'pointer-events-none absolute inset-x-2.5 bottom-2.5 z-[2] flex flex-col items-start gap-2 sm:inset-x-3 sm:bottom-3',
            'transition duration-base ease-soft [@media(hover:hover)]:translate-y-3 [@media(hover:hover)]:opacity-0',
            'group-hover/card:translate-y-0 group-hover/card:opacity-100 group-has-focus-visible/card:translate-y-0 group-has-focus-visible/card:opacity-100 motion-reduce:[@media(hover:hover)]:translate-y-0',
          )}
        >
          {product.shades.length > 0 && <ShadeDots shades={product.shades} />}
          {action('overlay')}
        </div>
      </div>
    </article>
  );
}

function ShadeDots({ shades }: { shades: ProductCardData['shades'] }) {
  const extra = shades.length - MAX_DOTS;
  return (
    <p className="flex items-center gap-1 rounded-pill bg-white/90 px-2 py-1 shadow-soft">
      {shades.slice(0, MAX_DOTS).map((s) => (
        // Shade colours are product data (variant.shade_hex), not UI tokens.
        <span
          key={s.name}
          aria-hidden
          className="h-3.5 w-3.5 rounded-pill border border-ink-200"
          style={{ backgroundColor: s.hex }}
        />
      ))}
      {extra > 0 && (
        <span aria-hidden className="text-xs font-medium tabular-nums text-ink-500">
          +{extra}
        </span>
      )}
      <span className="sr-only">
        {shades.length} {shades.length === 1 ? 'shade' : 'shades'}
      </span>
    </p>
  );
}

type WishlistButtonProps = { pressed: boolean; title: string; onToggle: () => void };

/** Heart toggle; filling it plays a small burst (transform/opacity only, skipped when reduced). */
function WishlistButton({ pressed, title, onToggle }: WishlistButtonProps) {
  const heart = useRef<HTMLSpanElement>(null);
  const burst = useRef<HTMLSpanElement>(null);

  function onClick() {
    if (!pressed) playBurst(heart.current, burst.current);
    onToggle();
  }

  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={`Save ${title} to wishlist`}
      onClick={onClick}
      className="absolute right-1.5 top-1.5 z-[2] grid h-11 w-11 place-items-center rounded-pill sm:right-2 sm:top-2"
    >
      <span
        aria-hidden
        className={cn(
          'relative grid h-9 w-9 place-items-center rounded-pill bg-white/90 shadow-soft transition-colors duration-fast',
          pressed ? 'text-pink-600' : 'text-ink-900 hover:text-pink-600',
        )}
      >
        <span ref={burst} className="pointer-events-none absolute inset-0">
          {Array.from({ length: BURST_DOTS }, (_, i) => (
            <span
              key={i}
              className={cn(
                'absolute left-1/2 top-1/2 -ml-[3px] -mt-[3px] h-1.5 w-1.5 rounded-pill opacity-0',
                i % 2 ? 'bg-gold-500' : 'bg-pink-400',
              )}
            />
          ))}
        </span>
        <span ref={heart} className="grid place-items-center">
          <Heart className={cn('h-[18px] w-[18px]', pressed && 'fill-pink-600')} />
        </span>
      </span>
    </button>
  );
}

function playBurst(heart: HTMLElement | null, burst: HTMLElement | null) {
  if (!heart || !burst || typeof heart.animate !== 'function' || prefersReducedMotion()) return;
  const timing = { duration: DURATION.slow * 1000, easing: EASE_SOFT_CSS };
  heart.animate(
    [
      { transform: 'scale(0.6)' },
      { transform: 'scale(1.2)', offset: 0.55 },
      { transform: 'scale(1)' },
    ],
    timing,
  );
  Array.from(burst.children).forEach((dot, i) => {
    const angle = (i / BURST_DOTS) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * 20;
    const y = Math.sin(angle) * 20;
    dot.animate(
      [
        { transform: 'translate(0, 0) scale(0.4)', opacity: 1 },
        { transform: `translate(${x}px, ${y}px) scale(1)`, opacity: 0 },
      ],
      timing,
    );
  });
}

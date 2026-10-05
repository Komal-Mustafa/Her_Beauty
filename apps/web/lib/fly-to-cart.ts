import { prefersReducedMotion } from '@hb/ui';
import { EASE_SOFT_CSS } from '@hb/ui/motion';

/*
 * "Fly to cart" (docs/p5-catalog.md §5, §8): after an add, a copy of the product image flies from
 * the page to the header cart icon (`[data-cart-target]`) and fades, with WAAPI transform +
 * opacity only. Skipped under reduced motion, when the icon is off screen (nothing to land on) or
 * when no starting point is on screen. Purely decorative: the cart has already been updated.
 */

export const CART_TARGET_SELECTOR = '[data-cart-target]';
export const FLY_MS = 600;
/** Size of the copy when it starts from a button instead of the product image. */
const CHIP = 56;

export type Box = { left: number; top: number; width: number; height: number };
type Viewport = { width: number; height: number };

/** At least partly inside the viewport, and actually rendered (a hidden element has no size). */
export function isOnScreen(box: Box, viewport: Viewport): boolean {
  return (
    box.width > 0 &&
    box.height > 0 &&
    box.left < viewport.width &&
    box.top < viewport.height &&
    box.left + box.width > 0 &&
    box.top + box.height > 0
  );
}

/** Where the copy starts: the image's own box, or a small square centred on a button. */
export function startBox(from: Box, isImage: boolean): Box {
  if (isImage) return from;
  const size = Math.min(CHIP, Math.max(from.height, 1));
  return {
    left: from.left + from.width / 2 - size / 2,
    top: from.top + from.height / 2 - size / 2,
    width: size,
    height: size,
  };
}

/**
 * Moves a copy sitting on `from` onto the centre of `to`, shrinking it to the icon's size. It stays
 * opaque for most of the way and fades as it lands. Straight path, eased by the effect.
 */
export function flightKeyframes(from: Box, to: Box): Keyframe[] {
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const end = Math.min(1, Math.max(0.04, Math.min(to.width, to.height) / from.width));
  const at = (t: number) =>
    `translate(${round(dx * t)}px, ${round(dy * t)}px) scale(${round(1 + (end - 1) * t, 3)})`;
  return [
    { transform: at(0), opacity: 1 },
    { transform: at(0.75), opacity: 0.9, offset: 0.75 },
    { transform: at(1), opacity: 0 },
  ];
}

function round(n: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function viewport(): Viewport {
  return { width: window.innerWidth, height: window.innerHeight };
}

function visibleTarget(): HTMLElement | null {
  const view = viewport();
  const targets = document.querySelectorAll<HTMLElement>(CART_TARGET_SELECTOR);
  return Array.from(targets).find((el) => isOnScreen(el.getBoundingClientRect(), view)) ?? null;
}

type FlyToCartOptions = {
  /** URL of the product image to fly. */
  imageSrc: string;
  /** Starting points in order of preference, e.g. the gallery image, then the pressed button. */
  from: readonly (HTMLElement | null | undefined)[];
};

/** Plays the flight and returns its Animation, or null when it was skipped. */
export function flyToCart({ imageSrc, from }: FlyToCartOptions): Animation | null {
  if (typeof document === 'undefined' || prefersReducedMotion()) return null;
  const target = visibleTarget();
  if (!target) return null;
  const view = viewport();
  const source = from.find((el): el is HTMLElement =>
    Boolean(el && isOnScreen(el.getBoundingClientRect(), view)),
  );
  if (!source) return null;

  const box = startBox(source.getBoundingClientRect(), source instanceof HTMLImageElement);
  const ghost = document.createElement('img');
  ghost.src = imageSrc;
  ghost.alt = '';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.className =
    'pointer-events-none fixed z-[60] rounded-btn bg-blush-50 object-cover shadow-lift';
  Object.assign(ghost.style, {
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
  });
  if (typeof ghost.animate !== 'function') return null;

  document.body.append(ghost);
  const animation = ghost.animate(flightKeyframes(box, target.getBoundingClientRect()), {
    duration: FLY_MS,
    easing: EASE_SOFT_CSS,
    fill: 'forwards',
  });
  const cleanUp = () => ghost.remove();
  animation.addEventListener('finish', cleanUp);
  animation.addEventListener('cancel', cleanUp);
  return animation;
}

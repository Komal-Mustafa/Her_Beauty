/**
 * Shade re-tint (docs/p5-catalog.md §5 "Live shade", 04 §8): when the shopper picks another shade
 * the colour glides to it, damped (fast start, soft landing) over TINT_SECONDS, then lands exactly
 * on the target and stops asking for frames. Reduced motion swaps it at once. Plain numbers and no
 * three.js, so the maths is unit-tested; `ShadeMaterial` copies the result onto the material.
 */

/** 04 §7 `dur-slow`. */
export const TINT_SECONDS = 0.45;
/** Damping rate (1/s): about 99 % of the way there after TINT_SECONDS. */
const RATE = 10;
/** Longest step one frame may take: a canvas waking from sleep must not jump to the end. */
export const MAX_TINT_STEP = 1 / 30;

export type Rgb = { r: number; g: number; b: number };

export type Tint = {
  from: Rgb;
  to: Rgb;
  /** Seconds since the tint started. */
  elapsed: number;
  done: boolean;
};

export function startTint(from: Rgb, to: Rgb, instant = false): Tint {
  return {
    from: { r: from.r, g: from.g, b: from.b },
    to: { r: to.r, g: to.g, b: to.b },
    elapsed: instant ? TINT_SECONDS : 0,
    done: instant,
  };
}

/** 0 → 1 over TINT_SECONDS, exactly 1 at the end (normalised exponential damping). */
export function tintProgress(elapsed: number): number {
  if (elapsed <= 0) return 0;
  if (elapsed >= TINT_SECONDS) return 1;
  return (1 - Math.exp(-RATE * elapsed)) / (1 - Math.exp(-RATE * TINT_SECONDS));
}

/** Current colour of a tint. */
export function tintColor(t: Tint): Rgb {
  const p = tintProgress(t.elapsed);
  return {
    r: t.from.r + (t.to.r - t.from.r) * p,
    g: t.from.g + (t.to.g - t.from.g) * p,
    b: t.from.b + (t.to.b - t.from.b) * p,
  };
}

/** Advances by one frame of `delta` seconds (capped) and returns the colour to show. */
export function stepTint(t: Tint, delta: number): Rgb {
  if (!t.done) {
    t.elapsed += Math.min(Math.max(delta, 0), MAX_TINT_STEP);
    if (t.elapsed >= TINT_SECONDS) t.done = true;
  }
  return t.done ? { ...t.to } : tintColor(t);
}

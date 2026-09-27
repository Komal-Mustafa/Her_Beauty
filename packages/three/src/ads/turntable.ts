/**
 * Turntable motion for the sidebar 3D ad (docs/p4-home.md §3): a slow auto-spin about Y, drag to
 * spin with a short flick glide, arrow keys step it. Plain numbers and no three.js, so the maths is
 * unit-tested and the render loop only copies `angle` / `bob` onto a group.
 *
 * The constants are chosen so 8 s of auto-spin is exactly half a turn and two bob cycles: the
 * procedural perfume looks the same after 180°, which makes the recorded video ad loop seamless
 * (apps/web/scripts/render-ad-loop.mjs).
 */

/** Auto-spin speed in rad/s: half a turn every 8 s. */
export const SPIN_SPEED = Math.PI / 8;
/** Seconds per up-and-down float cycle while spinning. */
export const BOB_PERIOD = 4;
/** Float height in scene units (the models are ~2.5 tall). */
export const BOB_HEIGHT = 0.04;
/** Auto-spin comes back this many seconds after the shopper lets go. */
export const RESUME_AFTER = 3;
/** One arrow-key press. */
export const KEY_STEP = Math.PI / 8;
/** Radians per CSS pixel of horizontal drag. */
export const DRAG_GAIN = 0.012;
/** Fastest flick glide (rad/s), so a hard swipe never turns into a fast spin (04 §8). */
export const MAX_FLICK = 4;

// Time constants (1/s) for the exponential easing below.
const SPIN_EASE = 3;
const KEY_EASE = 10;
const FRICTION = 4;

export type Turntable = {
  /** Current yaw in radians (unbounded). */
  angle: number;
  /** Float phase in cycles (unbounded). */
  bob: number;
  /** Current auto-spin rate; eases towards SPIN_SPEED or 0. */
  spin: number;
  /** Glide left over from a drag flick, decays with friction. */
  glide: number;
  /** Where an arrow key asked the yaw to settle, or null. */
  target: number | null;
  dragging: boolean;
  /** Seconds since the shopper last touched it. */
  idle: number;
};

export function createTurntable(spinning: boolean): Turntable {
  return {
    angle: 0,
    bob: 0,
    spin: spinning ? SPIN_SPEED : 0,
    glide: 0,
    target: null,
    dragging: false,
    idle: RESUME_AFTER,
  };
}

const settle = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

/** Advances the turntable by `dt` seconds. Mutates and returns `t` (called every frame). */
export function stepTurntable(t: Turntable, dt: number, spinning: boolean): Turntable {
  if (t.dragging) return t;
  t.idle += dt;

  const wantSpin = spinning && t.idle >= RESUME_AFTER && t.target === null && t.glide === 0;
  t.spin += ((wantSpin ? SPIN_SPEED : 0) - t.spin) * settle(SPIN_EASE, dt);
  if (!wantSpin && Math.abs(t.spin) < 1e-3) t.spin = 0;
  t.angle += t.spin * dt;
  t.bob += (dt / BOB_PERIOD) * (t.spin / SPIN_SPEED);

  if (t.target !== null) {
    const left = t.target - t.angle;
    if (Math.abs(left) < 1e-3) {
      t.angle = t.target;
      t.target = null;
    } else {
      t.angle += left * settle(KEY_EASE, dt);
    }
  }

  if (t.glide !== 0) {
    t.angle += t.glide * dt;
    t.glide *= Math.exp(-FRICTION * dt);
    if (Math.abs(t.glide) < 0.01) t.glide = 0;
  }
  return t;
}

/** Pointer down: stop every automatic motion and follow the finger. */
export function grabTurntable(t: Turntable): Turntable {
  t.dragging = true;
  t.glide = 0;
  t.target = null;
  t.spin = 0;
  t.idle = 0;
  return t;
}

/** Pointer moved `dx` CSS px over `dt` seconds. */
export function dragTurntable(t: Turntable, dx: number, dt: number): Turntable {
  const turn = dx * DRAG_GAIN;
  t.angle += turn;
  if (dt > 0) t.glide = clamp(turn / dt, MAX_FLICK);
  t.idle = 0;
  return t;
}

/** Pointer up: keep the flick as a glide that slows to a stop. */
export function releaseTurntable(t: Turntable, flickFresh: boolean): Turntable {
  t.dragging = false;
  if (!flickFresh) t.glide = 0;
  t.idle = 0;
  return t;
}

/** Arrow key: step one notch left (-1) or right (+1), easing into place. */
export function nudgeTurntable(t: Turntable, direction: -1 | 1): Turntable {
  t.target = (t.target ?? t.angle) + direction * KEY_STEP;
  t.glide = 0;
  t.spin = 0;
  t.idle = 0;
  return t;
}

/** Nothing moves by itself any more: no spin, glide, arrow-key target or finger on it. */
export function turntableAtRest(t: Turntable): boolean {
  return !t.dragging && t.spin === 0 && t.glide === 0 && t.target === null;
}

/** Vertical float offset for the current bob phase. */
export function bobOffset(t: Turntable): number {
  return Math.sin(t.bob * Math.PI * 2) * BOB_HEIGHT;
}

function clamp(v: number, max: number): number {
  return Math.max(-max, Math.min(max, v));
}

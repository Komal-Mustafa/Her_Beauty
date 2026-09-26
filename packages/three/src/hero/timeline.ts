/**
 * Scroll → scene state for the cinematic hero (docs/frontend-plan.md §6).
 * Pure so it can be unit-tested and shared by the WebGL scene and any future video render.
 *
 *  0–25%  logo      · products hidden, gold dust only
 * 25–50%  objects   · lipstick + compact rise, light sweeps across the gold
 * 50–75%  story     · camera arcs 20°, three vendor products orbit in
 * 75–100% featured  · orbit collapses, the paid hero-ad product lands on the pedestal
 */

export const HERO_SCENE_BOUNDS = [0, 0.25, 0.5, 0.75, 1] as const;

export const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Smoothstep — soft in, soft out, never overshoots (04 §7: nothing bouncy). */
export const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Eased 0→1 progress of `p` across [a, b]. */
export const span = (p: number, a: number, b: number) => smooth((p - a) / (b - a));

const ARC = (20 * Math.PI) / 180;

export type HeroState = {
  scene: 0 | 1 | 2 | 3;
  camDistance: number;
  camArc: number;
  duoY: number;
  duoScale: number;
  sweepX: number;
  orbitScale: number;
  orbitAngle: number;
  orbitRadius: number;
  adY: number;
  adScale: number;
  pedestalY: number;
};

export function heroState(progress: number): HeroState {
  const p = clamp01(progress);
  const rise = span(p, 0.2, 0.45);
  const duoOut = span(p, 0.5, 0.62);
  const orbitIn = span(p, 0.52, 0.68);
  const orbitOut = span(p, 0.76, 0.88);
  const land = span(p, 0.8, 0.97);

  return {
    scene: Math.min(3, Math.floor(p * 4)) as HeroState['scene'],
    camDistance: lerp(9, 6.6, span(p, 0.2, 0.5)),
    camArc: ARC * (span(p, 0.5, 0.7) - span(p, 0.78, 0.95)),
    duoY: lerp(-4.5, 0, rise) + 3.5 * duoOut,
    duoScale: rise * (1 - duoOut),
    sweepX: lerp(-6, 6, span(p, 0.28, 0.5)),
    orbitScale: orbitIn * (1 - orbitOut),
    orbitAngle: (p - 0.5) * Math.PI * 1.6,
    orbitRadius: lerp(2.5, 0.6, orbitOut),
    adY: lerp(-4.5, 0, land),
    adScale: land,
    pedestalY: lerp(-9, -1.05, land),
  };
}

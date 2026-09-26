/**
 * Pure geometry helpers for the procedural product models.
 * Kept free of React so they can be unit-tested and reused by server-side tooling later.
 */

/** Height of a slanted lipstick tip at x, for a bullet of radius r and height h with a `cut` drop. */
export function slantTopY(x: number, r: number, h: number, cut: number): number {
  const t = (Math.min(Math.max(x, -r), r) + r) / (2 * r); // 0 at the back, 1 at the front
  return h / 2 - cut * t;
}

/**
 * Remaps the y of every vertex of a centred cylinder so its top becomes a slanted plane while the
 * rows below keep their order (no self-intersection). Mutates and returns `positions`.
 */
export function slantCylinderTop(
  positions: Float32Array,
  r: number,
  h: number,
  cut: number,
): Float32Array {
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i] ?? 0;
    const y = positions[i + 1] ?? 0;
    const t = (y + h / 2) / h;
    positions[i + 1] = -h / 2 + t * (slantTopY(x, r, h, cut) + h / 2);
  }
  return positions;
}

/** Profile (x = radius, y = height) for a lathe, going bottom → top. */
export type Profile = ReadonlyArray<readonly [number, number]>;

export const LIPSTICK_CASE_PROFILE: Profile = [
  [0, 0],
  [0.3, 0],
  [0.34, 0.03],
  [0.35, 0.12],
  [0.33, 0.2],
  [0.33, 0.95],
  [0.35, 1.0],
  [0.35, 1.08],
  [0, 1.08],
];

export const CREAM_JAR_PROFILE: Profile = [
  [0, 0],
  [0.62, 0],
  [0.7, 0.05],
  [0.74, 0.18],
  [0.74, 0.52],
  [0.68, 0.6],
  [0, 0.6],
];

export const JAR_LID_PROFILE: Profile = [
  [0, 0],
  [0.72, 0],
  [0.76, 0.04],
  [0.76, 0.26],
  [0.72, 0.3],
  [0, 0.3],
];

/** Deterministic PRNG (mulberry32) so particle layouts are stable between renders and tests. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `count` points spread uniformly inside a centred box of the given size. */
export function scatter(
  count: number,
  seed: number,
  size: readonly [number, number, number],
): Float32Array {
  const rand = mulberry32(seed);
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    out[i * 3] = (rand() - 0.5) * size[0];
    out[i * 3 + 1] = (rand() - 0.5) * size[1];
    out[i * 3 + 2] = (rand() - 0.5) * size[2];
  }
  return out;
}

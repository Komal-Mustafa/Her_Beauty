/**
 * Stored media keys → public URLs. Keys that already look like paths/URLs are returned as-is so
 * seeded placeholder assets (served by the web app from /public) keep working.
 * `procedural:<kind>` marks a 3D media row that uses the built-in procedural model (no .glb yet).
 */
export const PROCEDURAL_PREFIX = 'procedural:';
export const MODEL_KINDS = ['lipstick', 'compact', 'perfume', 'jar'] as const;
export type ModelKind = (typeof MODEL_KINDS)[number];

export function mediaUrl(key: string | null | undefined): string {
  if (!key) return '';
  if (key.startsWith(PROCEDURAL_PREFIX)) return '';
  if (key.startsWith('/') || /^https?:\/\//.test(key)) return key;
  const base = process.env.MEDIA_BASE_URL ?? '';
  return `${base.replace(/\/$/, '')}/${key}`;
}

export function proceduralKind(key: string): ModelKind | null {
  if (!key.startsWith(PROCEDURAL_PREFIX)) return null;
  const kind = key.slice(PROCEDURAL_PREFIX.length);
  return (MODEL_KINDS as readonly string[]).includes(kind) ? (kind as ModelKind) : null;
}

/** Money columns are bigint paisa; API JSON uses integers (safe well below 2^53). */
export const money = (v: bigint) => Number(v);

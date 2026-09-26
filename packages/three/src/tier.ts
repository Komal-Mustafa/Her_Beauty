/**
 * Device tiers (02-trd §8, claude-code-prompt "Performance budget"):
 *  high → full 3D + bloom + particles
 *  mid  → 3D without post-processing, fewer particles, DPR ≤ 1.5
 *  low  → no WebGL: poster / video fallback
 */
export type DeviceTier = 'high' | 'mid' | 'low';

export type TierSignals = {
  gpuTier: number | null; // detect-gpu tier 0–3, null = unknown
  isMobile: boolean;
  reducedMotion: boolean;
  saveData: boolean;
  webgl: boolean;
};

export function resolveTier(s: TierSignals): DeviceTier {
  if (!s.webgl || s.reducedMotion || s.saveData) return 'low';
  if (s.gpuTier === null) return 'mid';
  if (s.gpuTier <= 1) return 'low';
  if (s.gpuTier === 2 || s.isMobile) return 'mid';
  return 'high';
}

export const TIER_SETTINGS: Record<
  DeviceTier,
  { maxDpr: number; particles: number; postprocessing: boolean; webgl: boolean }
> = {
  high: { maxDpr: 2, particles: 120, postprocessing: true, webgl: true },
  mid: { maxDpr: 1.5, particles: 40, postprocessing: false, webgl: true },
  low: { maxDpr: 1, particles: 0, postprocessing: false, webgl: false },
};

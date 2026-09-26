'use client';

import { useEffect, useState } from 'react';
import { resolveTier, type DeviceTier } from './tier';

type NavigatorWithConnection = Navigator & { connection?: { saveData?: boolean } };

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

let cached: Promise<DeviceTier> | null = null;

async function detect(forced: DeviceTier | null): Promise<DeviceTier> {
  if (forced) return forced;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = Boolean((navigator as NavigatorWithConnection).connection?.saveData);
  const webgl = hasWebGL();
  if (!webgl || reducedMotion || saveData) return 'low';
  // detect-gpu is loaded lazily so it never lands in the initial bundle.
  // TODO [CONFIRM]: self-host detect-gpu benchmark data (benchmarksURL) so CSP connect-src stays 'self'.
  const { getGPUTier } = await import('detect-gpu');
  const gpu = await getGPUTier().catch(() => null);
  return resolveTier({
    gpuTier: gpu?.tier ?? null,
    isMobile: Boolean(gpu?.isMobile),
    reducedMotion,
    saveData,
    webgl,
  });
}

/**
 * Returns null while detecting (render the static poster meanwhile), then the tier.
 * `?tier=high|mid|low` in the URL forces a tier for testing.
 */
export function useDeviceTier(): DeviceTier | null {
  const [tier, setTier] = useState<DeviceTier | null>(null);

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('tier');
    const forced = param === 'high' || param === 'mid' || param === 'low' ? param : null;
    if (forced) {
      setTier(forced);
      return;
    }
    let alive = true;
    cached ??= detect(null);
    void cached.then((t) => alive && setTier(t));
    return () => {
      alive = false;
    };
  }, []);

  return tier;
}

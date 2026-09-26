'use client';

import { Bloom, EffectComposer } from '@react-three/postprocessing';

/** High tier only (loaded lazily): a soft glow on the brightest gold highlights only. */
export default function Effects() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom mipmapBlur intensity={0.3} luminanceThreshold={1} luminanceSmoothing={0.1} />
    </EffectComposer>
  );
}

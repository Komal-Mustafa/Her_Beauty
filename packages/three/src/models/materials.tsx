'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Color, type MeshPhysicalMaterial } from 'three';
import { prefersReducedMotion } from '../reduced-motion';
import { COLORS_3D, GOLD_MATERIAL, LIPSTICK_MATERIAL } from '../tokens';
import { startTint, stepTint, type Tint } from './tint';

export function GoldMaterial({ deep = false }: { deep?: boolean }) {
  return (
    <meshPhysicalMaterial
      {...GOLD_MATERIAL}
      color={deep ? COLORS_3D.goldDeep : GOLD_MATERIAL.color}
    />
  );
}

/**
 * A shade-coloured material (the lipstick bullet and band, the compact's pan, the perfume) that
 * glides to a new hex instead of snapping (docs/p5-catalog.md §5, see tint.ts): ~450 ms, damped.
 * It asks for frames only while the colour is moving, so a canvas on the `demand` frame loop draws
 * the whole glide and then goes back to sleep. Reduced motion swaps the colour at once.
 */
export function ShadeMaterial({
  hex,
  roughness = LIPSTICK_MATERIAL.roughness,
}: {
  hex: string;
  roughness?: number;
}) {
  const ref = useRef<MeshPhysicalMaterial>(null);
  const tint = useRef<Tint | null>(null);
  const invalidate = useThree((s) => s.invalidate);
  // The colour prop never changes after mount, so a re-render cannot reset a glide half-way.
  const initial = useRef(hex);

  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const target = new Color(hex);
    if (m.color.equals(target)) {
      tint.current = null;
      return;
    }
    // From wherever the colour is now, so a new pick mid-glide turns smoothly.
    const next = startTint(m.color, target, prefersReducedMotion());
    if (next.done) {
      m.color.copy(target);
      tint.current = null;
    } else {
      tint.current = next;
    }
    invalidate();
  }, [hex, invalidate]);

  useFrame((_, delta) => {
    const m = ref.current;
    const t = tint.current;
    if (!m || !t) return;
    const c = stepTint(t, delta);
    // Tint endpoints were read from Color, so these are working-space (linear) values too.
    m.color.setRGB(c.r, c.g, c.b);
    if (t.done) tint.current = null;
    else invalidate();
  });
  return (
    <meshPhysicalMaterial
      ref={ref}
      color={initial.current}
      roughness={roughness}
      metalness={LIPSTICK_MATERIAL.metalness}
      clearcoat={LIPSTICK_MATERIAL.clearcoat}
    />
  );
}

/** Glass: real transmission on the high tier, a cheap translucent stand-in elsewhere. */
export function GlassMaterial({ transmission }: { transmission: boolean }) {
  return transmission ? (
    <meshPhysicalMaterial
      color={COLORS_3D.blush}
      transmission={1}
      thickness={0.6}
      roughness={0.05}
      ior={1.5}
      clearcoat={1}
    />
  ) : (
    <meshPhysicalMaterial
      color={COLORS_3D.pinkMist}
      transparent
      opacity={0.35}
      roughness={0.05}
      clearcoat={1}
      depthWrite={false}
    />
  );
}

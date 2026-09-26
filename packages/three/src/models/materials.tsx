'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, type MeshPhysicalMaterial } from 'three';
import { COLORS_3D, GOLD_MATERIAL, LIPSTICK_MATERIAL } from '../tokens';

export function GoldMaterial({ deep = false }: { deep?: boolean }) {
  return (
    <meshPhysicalMaterial
      {...GOLD_MATERIAL}
      color={deep ? COLORS_3D.goldDeep : GOLD_MATERIAL.color}
    />
  );
}

/** A shade-coloured material that eases to a new hex instead of snapping (04 §8 shade swap). */
export function ShadeMaterial({
  hex,
  roughness = LIPSTICK_MATERIAL.roughness,
}: {
  hex: string;
  roughness?: number;
}) {
  const ref = useRef<MeshPhysicalMaterial>(null);
  const target = useMemo(() => new Color(hex), [hex]);
  const initial = useRef(hex);
  useFrame((_, delta) => {
    const m = ref.current;
    if (!m || m.color.equals(target)) return;
    m.color.lerp(target, Math.min(1, delta * 6));
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

'use client';

import { RoundedBox } from '@react-three/drei';
import { GoldMaterial, GlassMaterial, ShadeMaterial } from './materials';

export type PerfumeProps = { shadeHex: string; transmission?: boolean };

/** Faceted glass bottle with tinted liquid, gold collar and a gold cap. */
export function Perfume({ shadeHex, transmission = false }: PerfumeProps) {
  return (
    <group position={[0, -0.75, 0]}>
      <RoundedBox
        args={[1.1, 1.2, 0.55]}
        radius={0.12}
        smoothness={4}
        position={[0, 0.6, 0]}
        castShadow
      >
        <GlassMaterial transmission={transmission} />
      </RoundedBox>
      <RoundedBox args={[0.94, 0.8, 0.4]} radius={0.08} smoothness={3} position={[0, 0.48, 0]}>
        <ShadeMaterial hex={shadeHex} roughness={0.2} />
      </RoundedBox>
      <mesh position={[0, 1.27, 0]}>
        <cylinderGeometry args={[0.13, 0.15, 0.14, 32]} />
        <GoldMaterial deep />
      </mesh>
      <mesh position={[0, 1.52, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.26, 0.36, 8]} />
        <GoldMaterial />
      </mesh>
    </group>
  );
}

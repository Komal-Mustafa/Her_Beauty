'use client';

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';
import { COLORS_3D } from '../tokens';
import { GoldMaterial, ShadeMaterial } from './materials';

const R = 0.85;

export type CompactProps = { shadeHex: string; lidOpen?: number };

/** Round compact with a hinged mirrored lid. `lidOpen` 0 = closed, 1 = fully open (~105°). */
export function Compact({ shadeHex, lidOpen = 0.8 }: CompactProps) {
  const lid = useRef<Group>(null);
  useFrame((_, delta) => {
    const l = lid.current;
    if (!l) return;
    const target = -lidOpen * 1.83;
    l.rotation.x += (target - l.rotation.x) * Math.min(1, delta * 4);
  });

  return (
    <group position={[0, -0.4, 0]} rotation={[0.35, 0, 0]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[R, R, 0.2, 64]} />
        <GoldMaterial />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[R * 0.8, R * 0.8, 0.03, 64]} />
        <ShadeMaterial hex={shadeHex} roughness={0.85} />
      </mesh>
      {/* hinge at the back edge */}
      <group ref={lid} position={[0, 0.1, -R]}>
        <group position={[0, 0.05, R]}>
          <mesh castShadow>
            <cylinderGeometry args={[R, R, 0.1, 64]} />
            <GoldMaterial />
          </mesh>
          <mesh position={[0, 0.06, 0]}>
            <torusGeometry args={[R * 0.72, 0.025, 12, 64]} />
            <GoldMaterial deep />
          </mesh>
          <mesh position={[0, -0.051, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[R * 0.82, 64]} />
            <meshStandardMaterial color={COLORS_3D.blush} metalness={1} roughness={0.04} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

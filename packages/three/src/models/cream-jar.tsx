'use client';

import { useMemo } from 'react';
import { LatheGeometry, Vector2 } from 'three';
import { CREAM_JAR_PROFILE, JAR_LID_PROFILE } from '../geometry';
import { COLORS_3D } from '../tokens';
import { GoldMaterial } from './materials';

/** Porcelain cream jar with a gold screw lid. */
export function CreamJar({ shadeHex }: { shadeHex: string }) {
  const [body, lid] = useMemo(
    () =>
      [CREAM_JAR_PROFILE, JAR_LID_PROFILE].map(
        (p) =>
          new LatheGeometry(
            p.map(([x, y]) => new Vector2(x, y)),
            64,
          ),
      ),
    [],
  );
  return (
    <group position={[0, -0.5, 0]}>
      <mesh geometry={body} castShadow receiveShadow>
        <meshPhysicalMaterial color={COLORS_3D.pinkMist} roughness={0.3} clearcoat={0.8} />
      </mesh>
      <mesh position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.745, 0.015, 8, 64]} />
        <meshStandardMaterial color={shadeHex} roughness={0.4} />
      </mesh>
      <mesh geometry={lid} position={[0, 0.6, 0]} castShadow>
        <GoldMaterial />
      </mesh>
    </group>
  );
}

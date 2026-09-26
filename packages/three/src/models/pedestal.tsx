'use client';

import { COLORS_3D } from '../tokens';
import { GoldMaterial } from './materials';

/** White marble plinth with a thin gold trim — the "studio" base under every product. */
export function Pedestal({ y = -1.05 }: { y?: number }) {
  return (
    <group position={[0, y, 0]}>
      <mesh receiveShadow position={[0, -0.15, 0]}>
        <cylinderGeometry args={[1.3, 1.4, 0.3, 96]} />
        <meshPhysicalMaterial color={COLORS_3D.marble} roughness={0.35} clearcoat={0.6} />
      </mesh>
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.3, 0.012, 8, 128]} />
        <GoldMaterial />
      </mesh>
    </group>
  );
}

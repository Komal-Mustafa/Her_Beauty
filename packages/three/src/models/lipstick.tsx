'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { CylinderGeometry, LatheGeometry, Vector2, type Group } from 'three';
import { LIPSTICK_CASE_PROFILE, slantCylinderTop } from '../geometry';
import { GoldMaterial, ShadeMaterial } from './materials';

const BULLET_R = 0.22;
const BULLET_H = 0.72;
const SLEEVE_TOP = 1.5;

export type LipstickProps = { shadeHex: string; open?: number };

/** Procedural lipstick: lathe gold case, rising sleeve and a slanted bullet in the chosen shade. */
export function Lipstick({ shadeHex, open = 1 }: LipstickProps) {
  const caseGeo = useMemo(
    () =>
      new LatheGeometry(
        LIPSTICK_CASE_PROFILE.map(([x, y]) => new Vector2(x, y)),
        64,
      ),
    [],
  );
  const bulletGeo = useMemo(() => {
    const g = new CylinderGeometry(BULLET_R, BULLET_R, BULLET_H, 48, 8);
    slantCylinderTop(g.attributes.position?.array as Float32Array, BULLET_R, BULLET_H, 0.3);
    g.attributes.position!.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }, []);

  // The bullet twists up out of a fixed sleeve; `open` 0 = retracted, 1 = fully up.
  const bullet = useRef<Group>(null);
  useFrame((_, delta) => {
    const b = bullet.current;
    if (!b) return;
    const y = SLEEVE_TOP - BULLET_H / 2 + 0.08 + open * 0.55;
    b.position.y += (y - b.position.y) * Math.min(1, delta * 4);
  });

  return (
    <group position={[0, -1.05, 0]}>
      <mesh geometry={caseGeo} castShadow receiveShadow>
        <GoldMaterial />
      </mesh>
      {/* shade band where the sleeve meets the case */}
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.04, 48]} />
        <ShadeMaterial hex={shadeHex} roughness={0.3} />
      </mesh>
      <mesh position={[0, (1.12 + SLEEVE_TOP) / 2, 0]} castShadow>
        <cylinderGeometry args={[0.27, 0.27, SLEEVE_TOP - 1.12, 48]} />
        <GoldMaterial deep />
      </mesh>
      <group ref={bullet} position={[0, SLEEVE_TOP - BULLET_H / 2 + 0.08 + open * 0.55, 0]}>
        <mesh geometry={bulletGeo} castShadow>
          <ShadeMaterial hex={shadeHex} />
        </mesh>
      </group>
    </group>
  );
}

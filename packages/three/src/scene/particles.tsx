'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Object3D, Shape, ShapeGeometry, type InstancedMesh, type Points } from 'three';
import { mulberry32, scatter } from '../geometry';
import { COLORS_3D } from '../tokens';

const BOX: [number, number, number] = [7, 5, 4];

/** Slowly rising gold dust (points). */
export function GoldDust({ count, seed = 11 }: { count: number; seed?: number }) {
  const positions = useMemo(() => scatter(count, seed, BOX), [count, seed]);
  const ref = useRef<Points>(null);
  useFrame((state) => {
    const p = ref.current;
    if (!p) return;
    p.rotation.y = state.clock.elapsedTime * 0.03;
    p.position.y = Math.sin(state.clock.elapsedTime * 0.25) * 0.15;
  });
  if (count === 0) return null;
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={COLORS_3D.gold}
        size={0.035}
        sizeAttenuation
        transparent
        opacity={0.85}
        depthWrite={false}
      />
    </points>
  );
}

function petalGeometry() {
  const s = new Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.08, 0.05, 0.1, 0.16, 0, 0.24);
  s.bezierCurveTo(-0.1, 0.16, -0.08, 0.05, 0, 0);
  return new ShapeGeometry(s, 8);
}

/** Pink petals drifting down and tumbling, re-spawned at the top (instanced: one draw call). */
export function Petals({ count, seed = 5 }: { count: number; seed?: number }) {
  const ref = useRef<InstancedMesh>(null);
  const geo = useMemo(petalGeometry, []);
  const dummy = useMemo(() => new Object3D(), []);
  const state = useMemo(() => {
    const rand = mulberry32(seed);
    const pos = scatter(count, seed, BOX);
    return Array.from({ length: count }, (_, i) => ({
      x: pos[i * 3] ?? 0,
      y: pos[i * 3 + 1] ?? 0,
      z: pos[i * 3 + 2] ?? 0,
      speed: 0.12 + rand() * 0.18,
      spin: (rand() - 0.5) * 1.6,
      phase: rand() * Math.PI * 2,
    }));
  }, [count, seed]);

  useEffect(() => () => geo.dispose(), [geo]);

  useFrame((clock, delta) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.clock.elapsedTime;
    state.forEach((p, i) => {
      p.y -= p.speed * delta;
      if (p.y < -BOX[1] / 2) p.y = BOX[1] / 2;
      dummy.position.set(p.x + Math.sin(t * 0.6 + p.phase) * 0.25, p.y, p.z);
      dummy.rotation.set(t * p.spin, t * p.spin * 0.7, p.phase);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (count === 0) return null;
  return (
    <instancedMesh ref={ref} args={[geo, undefined, count]}>
      <meshStandardMaterial
        color={COLORS_3D.pinkSoft}
        emissive={COLORS_3D.pinkSoft}
        emissiveIntensity={0.45}
        side={2}
        roughness={0.6}
        transparent
        opacity={0.9}
      />
    </instancedMesh>
  );
}

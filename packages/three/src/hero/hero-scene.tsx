'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { lazy, Suspense, useRef, type RefObject } from 'react';
import type { Group, SpotLight } from 'three';
import { TieredCanvas } from '../canvas/tiered-canvas';
import { ProceduralModel, type ModelKind } from '../models/model';
import { Pedestal } from '../models/pedestal';
import { GoldDust, Petals } from '../scene/particles';
import { Studio } from '../scene/studio';
import { TIER_SETTINGS, type DeviceTier } from '../tier';
import { heroState } from './timeline';

const Effects = lazy(() => import('../scene/effects'));

export type HeroProduct = { kind: ModelKind; shadeHex: string };

export type HeroSceneProps = {
  tier: Exclude<DeviceTier, 'low'>;
  /** 0–1 scroll progress through the hero, written by the page's ScrollTrigger. */
  progress: RefObject<number>;
  /** Pause control (04 §10): stops idle spin and particles; scroll still drives the film. */
  paused: boolean;
  duo: readonly [HeroProduct, HeroProduct];
  orbit: readonly HeroProduct[];
  featured: HeroProduct | null;
  className?: string;
  onReady?: () => void;
};

function Rig({
  progress,
  paused,
  duo,
  orbit,
  featured,
}: Omit<HeroSceneProps, 'tier' | 'className'>) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const smoothed = useRef(0);
  const idle = useRef(0);
  const duoRef = useRef<Group>(null);
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);
  const ring = useRef<Group>(null);
  const ad = useRef<Group>(null);
  const plinth = useRef<Group>(null);
  const sweep = useRef<SpotLight>(null);

  useFrame((_, delta) => {
    // Ease toward the scroll position so wheel steps never look jumpy.
    smoothed.current += ((progress.current ?? 0) - smoothed.current) * Math.min(1, delta * 5);
    if (!paused) idle.current += delta;
    const s = heroState(smoothed.current);
    const t = idle.current;

    // Portrait screens: pull the camera back so both products fit, and aim lower so the scene sits
    // above the ad card at the bottom of the stage.
    const aspect = size.width / Math.max(1, size.height);
    const portrait = aspect < 1;
    const fit = Math.min(2.6, Math.max(1, 1.15 / aspect));
    const dist = s.camDistance * fit;
    const lookY = portrait ? -1.1 : 0;
    camera.position.set(Math.sin(s.camArc) * dist, 0.7 + lookY, Math.cos(s.camArc) * dist);
    camera.lookAt(0, lookY, 0);

    if (duoRef.current) {
      duoRef.current.position.y = s.duoY;
      duoRef.current.scale.setScalar(Math.max(0.001, s.duoScale));
    }
    if (left.current) left.current.rotation.y = t * 0.25 + smoothed.current * 2;
    if (right.current) right.current.rotation.y = -t * 0.2 - smoothed.current * 1.5;

    if (ring.current) {
      ring.current.scale.setScalar(Math.max(0.001, s.orbitScale));
      ring.current.rotation.y = s.orbitAngle + t * 0.1;
      ring.current.children.forEach((child, i) => {
        const a = (i / ring.current!.children.length) * Math.PI * 2;
        child.position.set(
          Math.cos(a) * s.orbitRadius,
          Math.sin(t * 0.8 + i) * 0.08,
          Math.sin(a) * s.orbitRadius,
        );
        child.rotation.y = -s.orbitAngle + t * 0.3;
      });
    }

    if (ad.current) {
      ad.current.position.y = s.adY;
      ad.current.scale.setScalar(Math.max(0.001, s.adScale));
      ad.current.rotation.y = t * 0.2;
    }
    if (plinth.current) plinth.current.position.y = s.pedestalY + 1.05;
    if (sweep.current) sweep.current.position.x = s.sweepX;
  });

  return (
    <>
      <spotLight
        ref={sweep}
        position={[-6, 3, 3]}
        angle={0.35}
        penumbra={0.8}
        intensity={25}
        color="#FFF1D6"
      />
      <group ref={duoRef}>
        <group ref={left} position={[-0.95, 0.1, 0]} rotation={[0, 0, 0.12]}>
          <ProceduralModel kind={duo[0].kind} shadeHex={duo[0].shadeHex} />
        </group>
        <group ref={right} position={[1.05, 0, 0]} scale={0.8}>
          <ProceduralModel kind={duo[1].kind} shadeHex={duo[1].shadeHex} lidOpen={0.75} />
        </group>
      </group>
      <group ref={ring} position={[0, -0.55, 0]}>
        {orbit.map((p, i) => (
          <group key={i} scale={0.6}>
            <ProceduralModel kind={p.kind} shadeHex={p.shadeHex} />
          </group>
        ))}
      </group>
      <group ref={plinth}>
        <Pedestal />
      </group>
      {featured ? (
        <group ref={ad}>
          <ProceduralModel kind={featured.kind} shadeHex={featured.shadeHex} transmission />
        </group>
      ) : null}
    </>
  );
}

/** The 4-scene WebGL film behind the hero copy. Mount only for mid/high tiers via next/dynamic. */
export function HeroScene({ tier, className, onReady, ...rig }: HeroSceneProps) {
  const settings = TIER_SETTINGS[tier];
  return (
    <TieredCanvas
      tier={tier}
      className={className}
      camera={{ position: [0, 0.7, 9], fov: 32 }}
      onReady={onReady}
    >
      <Studio tier={tier} />
      <Rig {...rig} />
      {rig.paused ? null : (
        <>
          <GoldDust count={settings.particles} />
          <Petals count={Math.round(settings.particles / 5)} />
        </>
      )}
      {settings.postprocessing ? (
        <Suspense fallback={null}>
          <Effects />
        </Suspense>
      ) : null}
    </TieredCanvas>
  );
}

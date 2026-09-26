'use client';

import { ContactShadows, Environment, Lightformer } from '@react-three/drei';
import type { DeviceTier } from '../tier';
import { COLORS_3D } from '../tokens';

/**
 * Soft beauty-studio lighting. The environment map is built from Lightformers on the GPU, so no
 * HDRI is fetched from a CDN (keeps CSP connect-src 'self', security.md §9).
 */
export function Studio({ tier }: { tier: Exclude<DeviceTier, 'low'> }) {
  return (
    <>
      <ambientLight intensity={0.35} color={COLORS_3D.blush} />
      <directionalLight
        position={[3, 5, 4]}
        intensity={1.6}
        color="#FFF1D6"
        castShadow={tier === 'high'}
      />
      <spotLight
        position={[-4, 2, -3]}
        angle={0.6}
        penumbra={1}
        intensity={25}
        color={COLORS_3D.pinkSoft}
      />
      <Environment resolution={tier === 'high' ? 256 : 128} frames={1}>
        {/* warm blush "room" so metals reflect cream and pink, never black */}
        <color attach="background" args={[COLORS_3D.pinkMist]} />
        <Lightformer
          form="rect"
          intensity={1.2}
          color="#FFF1D6"
          position={[0, -3, 2]}
          rotation-x={Math.PI / 2}
          scale={[8, 4, 1]}
        />
        <Lightformer
          form="rect"
          intensity={2.5}
          color="#FFFFFF"
          position={[0, 4, 3]}
          scale={[6, 2, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.6}
          color={COLORS_3D.gold}
          position={[4, 1, 0]}
          rotation-y={-Math.PI / 2}
          scale={[4, 1.2, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.4}
          color={COLORS_3D.pinkSoft}
          position={[-4, 1, 0]}
          rotation-y={Math.PI / 2}
          scale={[4, 1.2, 1]}
        />
        <Lightformer
          form="ring"
          intensity={1}
          color={COLORS_3D.blush}
          position={[0, 0, -5]}
          scale={3}
        />
      </Environment>
      <ContactShadows
        position={[0, -1.06, 0]}
        opacity={0.35}
        scale={5}
        blur={2.6}
        far={2}
        resolution={tier === 'high' ? 512 : 256}
        frames={tier === 'high' ? Infinity : 1}
        color={COLORS_3D.pink}
      />
    </>
  );
}

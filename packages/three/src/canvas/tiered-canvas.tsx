'use client';

import { addAfterEffect, Canvas, useThree, type CanvasProps } from '@react-three/fiber';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Texture } from 'three';
import { TIER_SETTINGS, type DeviceTier } from '../tier';
import { findSharedLut } from './shared-textures';

type TieredCanvasProps = {
  tier: Exclude<DeviceTier, 'low'>;
  children: ReactNode;
  className?: string;
  camera?: CanvasProps['camera'];
  /** Called once the first frame is on screen, e.g. to fade the canvas in over a poster. */
  onReady?: () => void;
  /** 'demand' draws only when the scene calls invalidate(), for a scene that is standing still. */
  frameloop?: 'always' | 'demand';
};

/**
 * Disposes three's shared DFG texture when the canvas unmounts (see `findSharedLut`): that removes
 * the listener through which it holds this renderer, so the canvas and the page it was on can be
 * collected. Another canvas still on screen uploads the texture again on its next frame. The
 * texture is found after a drawn frame, while the renderer still knows its materials (R3F's
 * teardown, after this cleanup, resets that).
 */
function ReleaseSharedTextures() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    let lut: Texture | null = null;
    const stop = addAfterEffect(() => {
      lut ??= findSharedLut(gl, scene);
      if (lut) stop();
    });
    return () => {
      stop();
      lut?.dispose();
    };
  }, [gl, scene]);
  return null;
}

/**
 * R3F canvas tuned per device tier (02-trd §8):
 * - DPR capped by tier, antialias + shadows on high only
 * - render loop pauses when the canvas is off-screen or the tab is hidden, so a page with several
 *   3D blocks only ever animates what the shopper can see
 * - R3F disposes the renderer and forces context loss on unmount; the texture three shares between
 *   renderers is let go of too, or it would keep this canvas and its page alive (02-trd §8)
 */
export function TieredCanvas({
  tier,
  children,
  className,
  camera,
  onReady,
  frameloop = 'always',
}: TieredCanvasProps) {
  const settings = TIER_SETTINGS[tier];
  const wrap = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setOnScreen(Boolean(entry?.isIntersecting)), {
      rootMargin: '100px',
    });
    io.observe(el);
    const onVis = () => setPageVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return (
    <div ref={wrap} className={className}>
      <Canvas
        dpr={[1, settings.maxDpr]}
        frameloop={onScreen && pageVisible ? frameloop : 'never'}
        shadows={tier === 'high'}
        gl={{ antialias: tier === 'high', alpha: true, powerPreference: 'high-performance' }}
        camera={camera ?? { position: [0, 0.9, 6.4], fov: 32 }}
        onCreated={() => requestAnimationFrame(() => onReady?.())}
      >
        <ReleaseSharedTextures />
        {children}
      </Canvas>
    </div>
  );
}

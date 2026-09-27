'use client';

import { useFrame, useThree } from '@react-three/fiber';
import {
  useEffect,
  useRef,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { MathUtils, PerspectiveCamera, type Group } from 'three';
import { TieredCanvas } from '../canvas/tiered-canvas';
import { Model, type ModelKind } from '../models/model';
import { Pedestal } from '../models/pedestal';
import { Studio } from '../scene/studio';
import type { DeviceTier } from '../tier';
import {
  bobOffset,
  createTurntable,
  dragTurntable,
  grabTurntable,
  nudgeTurntable,
  releaseTurntable,
  stepTurntable,
  type Turntable,
} from './turntable';

export type AdModelStageProps = {
  /** The ad's headline; the stage is announced as "3D view of {label}, …". */
  label: string;
  kind: ModelKind;
  shadeHex: string;
  tier: Exclude<DeviceTier, 'low'>;
  /** Slow auto-spin and float. False once the shopper pressed Pause; drag and keys still work. */
  spinning?: boolean;
  className?: string;
  /** First frame is on screen (fade the stage in over the poster). */
  onReady?: () => void;
};

// What has to stay in frame: the pedestal (Ø 2.8, bottom at y -1.35, its front rim sits lower in
// perspective) and the tallest model (the open lipstick, top at y ≈ 1.45), with a little air.
// Units are scene units.
const FRAME_WIDTH = 3.4;
const FRAME_HEIGHT = 3.6;
const FRAME_CENTER_Y = -0.1;
const CAMERA_FOV = 30;
const CAMERA_TILT = MathUtils.degToRad(7);
/** A finger that rested this long before lifting leaves no glide. */
const FLICK_FRESH_MS = 80;

/**
 * Small 3D product stage for the sidebar ad (docs/p4-home.md §3): the ad's procedural model on
 * the marble pedestal, slowly turning. Drag sideways to spin (vertical swipes still scroll the
 * page), arrow keys turn it when focused. Built on TieredCanvas, so it stops rendering whenever it
 * is off screen or the tab is hidden. Load it through next/dynamic with ssr off.
 */
export function AdModelStage({
  label,
  kind,
  shadeHex,
  tier,
  spinning = true,
  className,
  onReady,
}: AdModelStageProps) {
  const turntable = useRef<Turntable>(createTurntable(spinning));
  const pointer = useRef<{ id: number; x: number; time: number } | null>(null);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || pointer.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointer.current = { id: e.pointerId, x: e.clientX, time: e.timeStamp };
    grabTurntable(turntable.current);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const p = pointer.current;
    if (!p || p.id !== e.pointerId) return;
    dragTurntable(turntable.current, e.clientX - p.x, (e.timeStamp - p.time) / 1000);
    pointer.current = { id: p.id, x: e.clientX, time: e.timeStamp };
  }

  function onPointerEnd(e: PointerEvent<HTMLDivElement>) {
    const p = pointer.current;
    if (!p || p.id !== e.pointerId) return;
    pointer.current = null;
    releaseTurntable(turntable.current, e.timeStamp - p.time < FLICK_FRESH_MS);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const direction = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    if (!direction) return;
    e.preventDefault();
    nudgeTurntable(turntable.current, direction);
  }

  return (
    <div
      role="group"
      aria-roledescription="3D viewer"
      aria-label={`3D view of ${label}, drag or use arrow keys to rotate`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      // The stage fills a clipped media box, so the focus ring is drawn inside it.
      className={`cursor-grab touch-pan-y select-none rounded-[inherit] focus-visible:outline-offset-[-4px] active:cursor-grabbing ${className ?? ''}`}
    >
      <TieredCanvas tier={tier} className="h-full w-full" onReady={onReady}>
        <FitCamera />
        <Studio tier={tier} />
        <Spinner turntable={turntable} spinning={spinning}>
          <Model kind={kind} shadeHex={shadeHex} transmission={tier === 'high'} />
        </Spinner>
        <Pedestal />
      </TieredCanvas>
    </div>
  );
}

function Spinner({
  turntable,
  spinning,
  children,
}: {
  turntable: RefObject<Turntable>;
  spinning: boolean;
  children: ReactNode;
}) {
  const group = useRef<Group>(null);
  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    // Clamp long gaps (tab switch, off-screen) so the model never jumps.
    const t = stepTurntable(turntable.current, Math.min(delta, 0.1), spinning);
    g.rotation.y = t.angle;
    g.position.y = bobOffset(t);
  });
  return <group ref={group}>{children}</group>;
}

/**
 * Keeps the pedestal and the product in frame for any box shape: 4:5 in the rail, 4:3 / 16:9
 * in the feed. Moves the camera back until both the width and the height fit.
 */
function FitCamera() {
  const camera = useThree((s) => s.camera);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);

  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera) || !width || !height) return;
    const aspect = width / height;
    const tan = Math.tan(MathUtils.degToRad(CAMERA_FOV / 2));
    const distance = Math.max(FRAME_HEIGHT / 2 / tan, FRAME_WIDTH / 2 / (tan * aspect));
    camera.fov = CAMERA_FOV;
    camera.position.set(
      0,
      FRAME_CENTER_Y + Math.sin(CAMERA_TILT) * distance,
      Math.cos(CAMERA_TILT) * distance,
    );
    camera.lookAt(0, FRAME_CENTER_Y, 0);
    camera.updateProjectionMatrix();
  }, [camera, width, height]);

  return null;
}

'use client';

import { Float, OrbitControls } from '@react-three/drei';
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
  type KeyboardEvent,
} from 'react';
import { TieredCanvas } from '../canvas/tiered-canvas';
import { Model, type ModelKind } from '../models/model';
import { Pedestal } from '../models/pedestal';
import { GoldDust, Petals } from '../scene/particles';
import { Studio } from '../scene/studio';
import { TIER_SETTINGS, type DeviceTier } from '../tier';
import { useDeviceTier } from '../use-device-tier';

const Effects = lazy(() => import('../scene/effects'));

export type ProductViewerProps = {
  name: string;
  kind: ModelKind;
  shadeHex: string;
  posterSrc: string;
  src?: string | null;
  lidOpen?: number;
  autoRotate?: boolean;
  particles?: boolean;
  /** Force a tier (tests, previews). Defaults to device detection. */
  tier?: DeviceTier;
  className?: string;
};

const ROTATE_STEP = Math.PI / 12;
const RESUME_AFTER_MS = 4000;

/**
 * 3D product viewer (03-app-web-flow PDP, 04 §8): drag to rotate, pinch/scroll to zoom within
 * limits, no pan. Arrow keys rotate for keyboard users. Low tier, reduced motion and "still
 * detecting" all show the poster, so the page is never blank.
 */
export function ProductViewer({
  name,
  kind,
  shadeHex,
  posterSrc,
  src,
  lidOpen,
  autoRotate = true,
  particles = true,
  tier: forcedTier,
  className,
}: ProductViewerProps) {
  const detected = useDeviceTier();
  const tier = forcedTier ?? detected;
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [spinning, setSpinning] = useState(autoRotate);

  useEffect(() => setSpinning(autoRotate), [autoRotate]);
  useEffect(() => () => clearTimeout(resumeTimer.current), []);

  const pauseSpin = () => {
    clearTimeout(resumeTimer.current);
    setSpinning(false);
  };
  const scheduleResume = () => {
    clearTimeout(resumeTimer.current);
    if (autoRotate) resumeTimer.current = setTimeout(() => setSpinning(true), RESUME_AFTER_MS);
  };

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const c = controls.current;
    if (!c) return;
    const az = e.key === 'ArrowLeft' ? -ROTATE_STEP : e.key === 'ArrowRight' ? ROTATE_STEP : 0;
    const po = e.key === 'ArrowUp' ? -ROTATE_STEP : e.key === 'ArrowDown' ? ROTATE_STEP : 0;
    if (!az && !po) return;
    e.preventDefault();
    pauseSpin();
    c.setAzimuthalAngle(c.getAzimuthalAngle() + az);
    c.setPolarAngle(c.getPolarAngle() + po);
    c.update();
    scheduleResume();
  }

  function reset() {
    controls.current?.reset();
    scheduleResume();
  }

  const frame = `relative overflow-hidden rounded-card bg-grad-pink ${className ?? ''}`;

  if (!tier || tier === 'low') {
    return (
      <div className={frame}>
        <img src={posterSrc} alt={name} className="h-full w-full object-contain" />
      </div>
    );
  }

  const settings = TIER_SETTINGS[tier];

  return (
    <div
      className={frame}
      role="group"
      aria-roledescription="3D viewer"
      aria-label={`3D view of ${name}. Drag or use the arrow keys to rotate.`}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <TieredCanvas tier={tier} className="h-full w-full touch-none">
        <Studio tier={tier} />
        <Float
          speed={1.4}
          rotationIntensity={0.15}
          floatIntensity={0.35}
          floatingRange={[-0.04, 0.06]}
        >
          <Model
            kind={kind}
            shadeHex={shadeHex}
            src={src}
            lidOpen={lidOpen}
            transmission={tier === 'high'}
          />
        </Float>
        <Pedestal />
        {particles ? (
          <>
            <GoldDust count={settings.particles} />
            <Petals count={Math.round(settings.particles / 6)} />
          </>
        ) : null}
        <OrbitControls
          ref={controls}
          makeDefault
          enablePan={false}
          enableDamping
          minDistance={3.6}
          maxDistance={9}
          minPolarAngle={Math.PI / 5}
          maxPolarAngle={Math.PI / 1.9}
          autoRotate={spinning}
          autoRotateSpeed={1.2}
          onStart={pauseSpin}
          onEnd={scheduleResume}
        />
        {settings.postprocessing ? (
          <Suspense fallback={null}>
            <Effects />
          </Suspense>
        ) : null}
      </TieredCanvas>
      <button
        type="button"
        onClick={reset}
        className="absolute right-3 bottom-3 rounded-pill bg-white/85 px-3 py-1.5 text-xs font-medium text-ink-900 shadow-soft backdrop-blur transition-colors duration-fast hover:bg-white"
      >
        Reset view
      </button>
    </div>
  );
}

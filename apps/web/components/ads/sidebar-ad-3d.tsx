'use client';

import { COLORS_3D, useDeviceTier } from '@hb/three';
import { cn } from '@hb/ui';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useEffect, useState, type RefObject } from 'react';
import { AdCard } from './ad-card';
import { adFrameClass, adMediaSizes, type SidebarAdProps } from './ad-layout';
import { HouseAd } from './house-ad';
import { useAdRotation } from './use-ad-rotation';

// three.js + R3F stay out of first-load JS: this chunk is fetched only when the stage mounts.
const AdModelStage = dynamic(() => import('@hb/three/3d').then((m) => m.AdModelStage), {
  ssr: false,
});

/** Half of the stage's crossfade: fade out, swap the model, fade in (duration-base each way). */
const SWAP_MS = 250;

/**
 * Left sidebar 3D ad (`left_3d`, docs/p4-home.md §3): the ad's procedural model on the marble
 * pedestal, slowly turning; drag or arrow keys spin it. The poster is server-rendered and stays
 * for tier low, Save-Data and reduced motion. WebGL mounts only once the card is near the
 * viewport and the browser is idle, and TieredCanvas stops drawing whenever it is off screen.
 */
export function SidebarAd3D({ ads, variant, className }: SidebarAdProps) {
  const rotation = useAdRotation(ads.length);
  const tier = useDeviceTier();
  const hasModels = ads.some((ad) => ad.media.model3dKind);
  // useDeviceTier already says `low` for Save-Data and reduced motion; the live preference is
  // checked too, so switching it on mid-visit drops back to the poster.
  const webgl = (tier === 'high' || tier === 'mid') && !rotation.reducedMotion && hasModels;
  const near = useNearViewport(rotation.bind.ref, webgl);
  const live = useMountWhenIdle(rotation.bind.ref, near) && webgl;

  const [ready, setReady] = useState(false);
  const [shown, setShown] = useState(0);
  const [swapping, setSwapping] = useState(false);

  // A stage that unmounts (reduced motion switched on) must show its poster again next time.
  useEffect(() => {
    if (!live) setReady(false);
  }, [live]);

  // The canvas cannot crossfade with itself: dip it out, swap the model, bring it back.
  useEffect(() => {
    if (rotation.index === shown) return;
    if (!ready) {
      setShown(rotation.index);
      return;
    }
    setSwapping(true);
    const timer = window.setTimeout(() => {
      setShown(rotation.index);
      setSwapping(false);
    }, SWAP_MS);
    return () => window.clearTimeout(timer);
  }, [rotation.index, shown, ready]);

  if (ads.length === 0) return <HouseAd variant={variant} className={className} />;

  // A poster-only ad in a mixed slot hides the stage (inert, still mounted with the last model)
  // instead of tearing the WebGL context down.
  const staged = [ads[shown], ...ads].find((ad) => ad?.media.model3dKind);
  const stagedKind = staged?.media.model3dKind ?? null;
  const stagedIsCurrent = staged === ads[shown];
  const stageOn = live && ready && !swapping && stagedIsCurrent;
  // Once the stage is up, posters stay hidden while it swaps (a flat poster flashing between two
  // 3D frames looks broken); they return for an ad that has no model.
  const postersOn = !(live && ready && ads[rotation.index]?.media.model3dKind);

  return (
    <AdCard
      variant={variant}
      ads={ads}
      rotation={rotation}
      className={className}
      playControl={
        live || (ads.length > 1 && !rotation.reducedMotion)
          ? { pause: 'Pause animation', play: 'Play animation' }
          : null
      }
      media={
        <>
          {ads.map((ad, i) =>
            ad.media.posterUrl ? (
              <div
                key={ad.id}
                className={cn(
                  adFrameClass(variant),
                  'transition-opacity duration-slow ease-soft',
                  postersOn && i === rotation.index ? 'opacity-100' : 'opacity-0',
                )}
              >
                <Image
                  src={ad.media.posterUrl}
                  alt=""
                  fill
                  sizes={adMediaSizes(variant)}
                  className="object-contain"
                />
              </div>
            ) : null,
          )}
          {live && staged && stagedKind ? (
            <div
              inert={!stageOn}
              className={cn(
                'absolute inset-0 rounded-[inherit] transition-opacity duration-base ease-soft',
                stageOn ? 'opacity-100' : 'opacity-0',
              )}
            >
              <AdModelStage
                label={staged.headline}
                kind={stagedKind}
                shadeHex={staged.media.shadeHex ?? COLORS_3D.pink}
                tier={tier === 'high' ? 'high' : 'mid'}
                spinning={rotation.playing && stagedIsCurrent}
                onReady={() => setReady(true)}
                className="h-full w-full"
              />
            </div>
          ) : null}
        </>
      }
    />
  );
}

/** Whether `ref` is within half a screen of the viewport, kept up to date as it moves. */
function useNearViewport(ref: RefObject<HTMLElement | null>, enabled: boolean): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const io = new IntersectionObserver(([entry]) => setNear(entry?.isIntersecting ?? false), {
      rootMargin: '50% 0px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, enabled]);
  return near;
}

/**
 * True (and stays true: TieredCanvas already stops drawing off screen) once the card is near the
 * viewport at a moment the browser is idle, so WebGL never delays LCP. The position is checked
 * again when idle comes: on first load the cinematic hero replaces its short fallback and pushes
 * the card thousands of pixels down, after the observer first saw it near.
 */
function useMountWhenIdle(ref: RefObject<HTMLElement | null>, near: boolean): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (!near || mounted) return;
    const ric = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
    const id = ric(() => {
      const rect = ref.current?.getBoundingClientRect();
      const margin = window.innerHeight / 2;
      if (rect && rect.top < window.innerHeight + margin && rect.bottom > -margin) setMounted(true);
    });
    return () => (window.cancelIdleCallback ?? window.clearTimeout)(id);
  }, [ref, near, mounted]);
  return mounted;
}

'use client';

import type { ServedAd } from '@hb/types';
import { cn } from '@hb/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AdCard } from './ad-card';
import { adFrameClass, type AdVariant, type SidebarAdProps } from './ad-layout';
import { HouseAd } from './house-ad';
import { useAdRotation } from './use-ad-rotation';

/**
 * Right sidebar video ad (`right_video`, docs/p4-home.md §3): a muted loop that plays only while
 * the card is visible and motion is allowed, with a visible Pause / Play button (04 §10). No
 * sound, so no captions track; the headline under the video is its text alternative.
 *
 * When the browser refuses to autoplay (battery saver) the button shows Play and the slot keeps
 * rotating. A file this browser cannot play at all leaves the poster, like a still ad.
 */
export function SidebarAdVideo({ ads, variant, className }: SidebarAdProps) {
  const rotation = useAdRotation(ads.length);
  const [unplayable, setUnplayable] = useState<ReadonlySet<string>>(() => new Set());
  const markUnplayable = useCallback(
    (id: string) => setUnplayable((ids) => (ids.has(id) ? ids : new Set(ids).add(id))),
    [],
  );
  if (ads.length === 0) return <HouseAd variant={variant} className={className} />;

  const current = ads[rotation.index];
  const hasVideo = current !== undefined && !unplayable.has(current.id);

  return (
    <AdCard
      variant={variant}
      ads={ads}
      rotation={rotation}
      className={className}
      playControl={
        hasVideo
          ? { pause: 'Pause video', play: 'Play video' }
          : // Nothing to play: the button stays only to stop the rotation (04 §10).
            ads.length > 1 && !rotation.reducedMotion
            ? { pause: 'Pause ads', play: 'Play ads' }
            : null
      }
      media={ads.map((ad, i) => (
        <AdVideo
          key={ad.id}
          ad={ad}
          variant={variant}
          active={i === rotation.index}
          play={rotation.animate && i === rotation.index && !unplayable.has(ad.id)}
          onBlocked={rotation.markBlocked}
          onUnplayable={markUnplayable}
        />
      ))}
    />
  );
}

function AdVideo({
  ad,
  variant,
  active,
  play,
  onBlocked,
  onUnplayable,
}: {
  ad: ServedAd;
  variant: AdVariant;
  active: boolean;
  play: boolean;
  onBlocked: () => void;
  onUnplayable: (id: string) => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const sourceRef = useRef<HTMLSourceElement>(null);
  const { id } = ad;

  // A browser that cannot play the only <source> skips it (its `error` may fire before hydration)
  // and waits for another, so play() never settles: ask up front. A failed download or decode
  // later fires `error` on the <source> (below).
  useEffect(() => {
    const type = sourceRef.current?.type;
    if (type && ref.current?.canPlayType(type) === '') onUnplayable(id);
  }, [id, onUnplayable]);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (!play) {
      video.pause();
      return;
    }
    // React does not put `muted` into server HTML, and a hydrated element keeps what the server
    // sent; browsers only allow play() without a gesture when the element is muted.
    video.muted = true;
    video.play().catch((error: unknown) => {
      // AbortError = paused again before it started; NotSupportedError = nothing playable.
      // Anything else (autoplay refused by a battery saver) keeps the poster up and shows Play.
      const name = error instanceof DOMException ? error.name : '';
      if (name === 'NotSupportedError') onUnplayable(id);
      else if (name !== 'AbortError') onBlocked();
    });
  }, [play, id, onBlocked, onUnplayable]);

  return (
    <video
      ref={ref}
      muted
      loop
      playsInline
      preload="none"
      poster={ad.media.posterUrl ?? undefined}
      disablePictureInPicture
      disableRemotePlayback
      // Decorative: the copy below carries the message and the button controls playback.
      aria-hidden
      tabIndex={-1}
      className={cn(
        adFrameClass(variant),
        'object-contain transition-opacity duration-slow ease-soft',
        active ? 'opacity-100' : 'opacity-0',
      )}
    >
      <source
        ref={sourceRef}
        src={ad.media.url}
        type={videoType(ad.media.url)}
        onError={() => onUnplayable(id)}
      />
    </video>
  );
}

/** Lets the browser skip a format it cannot play without downloading it. */
function videoType(url: string): string | undefined {
  const ext = url.split(/[?#]/)[0]?.split('.').pop()?.toLowerCase();
  return ext === 'webm' ? 'video/webm' : ext === 'mp4' ? 'video/mp4' : undefined;
}

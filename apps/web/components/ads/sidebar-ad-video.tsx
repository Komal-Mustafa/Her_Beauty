'use client';

import type { ServedAd } from '@hb/types';
import { cn } from '@hb/ui';
import { useEffect, useRef } from 'react';
import { AdCard } from './ad-card';
import type { SidebarAdProps } from './ad-layout';
import { HouseAd } from './house-ad';
import { useAdRotation } from './use-ad-rotation';

/**
 * Right sidebar video ad (`right_video`, docs/p4-home.md §3): a muted loop that plays only while
 * the card is visible and motion is allowed, with a visible Pause / Play button (04 §10). No
 * sound, so no captions track; the headline under the video is its text alternative.
 */
export function SidebarAdVideo({ ads, variant, className }: SidebarAdProps) {
  const rotation = useAdRotation(ads.length);
  if (ads.length === 0) return <HouseAd variant={variant} className={className} />;

  return (
    <AdCard
      variant={variant}
      ads={ads}
      rotation={rotation}
      className={className}
      // White like the card: a portrait video letterboxed in the feed blends in (our placeholder
      // loop fades to white edges for that reason).
      mediaClassName="bg-white"
      playControl={{ pause: 'Pause video', play: 'Play video' }}
      media={ads.map((ad, i) => (
        <AdVideo
          key={ad.id}
          ad={ad}
          active={i === rotation.index}
          play={rotation.animate && i === rotation.index}
          onBlocked={rotation.markPaused}
        />
      ))}
    />
  );
}

function AdVideo({
  ad,
  active,
  play,
  onBlocked,
}: {
  ad: ServedAd;
  active: boolean;
  play: boolean;
  onBlocked: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);

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
      // AbortError = paused again before it started. Anything else (autoplay refused by a
      // battery saver, unsupported file) keeps the poster up and turns the button into Play.
      if (!(error instanceof DOMException && error.name === 'AbortError')) onBlocked();
    });
  }, [play, onBlocked]);

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
        'absolute inset-0 h-full w-full object-contain transition-opacity duration-slow ease-soft',
        active ? 'opacity-100' : 'opacity-0',
      )}
    >
      <source src={ad.media.url} type={videoType(ad.media.url)} />
    </video>
  );
}

/** Lets the browser skip a format it cannot play without downloading it. */
function videoType(url: string): string | undefined {
  const ext = url.split(/[?#]/)[0]?.split('.').pop()?.toLowerCase();
  return ext === 'webm' ? 'video/webm' : ext === 'mp4' ? 'video/mp4' : undefined;
}

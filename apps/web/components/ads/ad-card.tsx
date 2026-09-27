'use client';

import type { ServedAd } from '@hb/types';
import { Badge, Button, cn } from '@hb/ui';
import { Pause, Play } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { adCardClass, adCopyClass, adMediaClass, type AdVariant } from './ad-layout';
import type { AdRotation } from './use-ad-rotation';

type AdCardProps = {
  variant: AdVariant;
  ads: readonly ServedAd[];
  rotation: AdRotation;
  /** Layers for the media box (posters, videos, the 3D stage), stacked with `absolute inset-0`. */
  media: ReactNode;
  /** Backdrop of the media box. */
  mediaClassName?: string;
  /** Pause / Play labels, or null when nothing on the card moves. */
  playControl: { pause: string; play: string } | null;
  className?: string;
};

/**
 * Sidebar ad shell (docs/p4-home.md §3): white card, gold border, always "Sponsored" (PRD §7.6),
 * seller, Playfair headline and a real link as CTA. Several ads share the card and crossfade
 * (opacity only); only the active one is focusable or read out, and there is no live region.
 *
 * TODO(P9): impression and click tracking.
 */
export function AdCard({
  variant,
  ads,
  rotation,
  media,
  mediaClassName,
  playControl,
  className,
}: AdCardProps) {
  const multi = ads.length > 1;
  const { ref, ...handlers } = rotation.bind;

  return (
    <div
      ref={ref}
      {...handlers}
      role="group"
      aria-roledescription={multi ? 'carousel' : undefined}
      aria-label="Sponsored"
      className={cn(adCardClass(variant), className)}
    >
      <div className={cn(adMediaClass(variant), mediaClassName)}>
        {media}
        {playControl ? (
          <button
            type="button"
            onClick={rotation.togglePlay}
            aria-label={rotation.playing ? playControl.pause : playControl.play}
            className="absolute right-2 bottom-2 z-10 grid h-11 w-11 place-items-center rounded-pill bg-white/85 text-ink-900 shadow-soft backdrop-blur hover:bg-white"
          >
            {rotation.playing ? (
              <Pause aria-hidden className="h-4 w-4" />
            ) : (
              <Play aria-hidden className="h-4 w-4" />
            )}
          </button>
        ) : null}
      </div>

      <div className={adCopyClass(variant)}>
        <Badge kind="sponsored" className="self-start" />
        <div className="grid">
          {ads.map((ad, i) => {
            const active = i === rotation.index;
            return (
              <div
                key={ad.id}
                role={multi ? 'group' : undefined}
                aria-roledescription={multi ? 'slide' : undefined}
                aria-label={multi ? `${i + 1} of ${ads.length}` : undefined}
                inert={!active}
                className={cn(
                  'col-start-1 row-start-1 flex flex-col transition-opacity duration-slow ease-soft',
                  active ? 'opacity-100' : 'pointer-events-none opacity-0',
                )}
              >
                <p className="text-sm text-ink-500">{ad.sellerName}</p>
                <p
                  className={cn(
                    'mt-1 font-display leading-snug font-medium text-ink-900',
                    variant === 'rail' ? 'text-xl' : 'text-2xl',
                  )}
                >
                  {ad.headline}
                </p>
                <Button
                  asChild
                  block={variant === 'rail'}
                  className={cn('mt-4', variant === 'inline' && 'self-start')}
                >
                  <Link href={ad.href}>{ad.ctaLabel}</Link>
                </Button>
              </div>
            );
          })}
        </div>
        {multi ? (
          <div className="-mb-2 -ml-3.5 flex">
            {ads.map((ad, i) => (
              <button
                key={ad.id}
                type="button"
                onClick={() => rotation.goTo(i)}
                aria-label={`Show ad ${i + 1} of ${ads.length}`}
                aria-current={i === rotation.index ? 'true' : undefined}
                // Inset focus ring: the first dot sits near the card edge, which clips.
                className="grid h-11 w-11 place-items-center rounded-pill hover:bg-blush-50 focus-visible:outline-offset-[-2px]"
              >
                <span
                  aria-hidden
                  className="relative block h-2.5 w-2.5 rounded-pill border border-pink-600"
                >
                  <span
                    className={cn(
                      'absolute -inset-px rounded-pill bg-pink-600 transition-[opacity,transform] duration-base ease-soft',
                      i === rotation.index ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
                    )}
                  />
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

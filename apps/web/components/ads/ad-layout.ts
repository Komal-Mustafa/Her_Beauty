import type { ServedAd } from '@hb/types';
import { cn } from '@hb/ui';

/** rail = 240 px column beside the home sections (≥1280); inline = full-width card in the feed. */
export type AdVariant = 'rail' | 'inline';

export type SidebarAdProps = {
  ads: readonly ServedAd[];
  variant: AdVariant;
  /** Placement from the page (sticky offset, breakpoint visibility); the card assumes no grid. */
  className?: string;
};

// Shared by paid cards and HouseAd: an empty slot keeps the same width and media box.
export const adCardClass = (variant: AdVariant) =>
  cn(
    'flex flex-col overflow-hidden rounded-card border border-gold-500 bg-white',
    variant === 'rail' ? 'w-60' : 'w-full sm:flex-row',
  );

/** Fixed ratio (04 §4, no layout shift): 4:5 in the rail; in-feed 4:3, then 16:9 beside the copy. */
export const adMediaClass = (variant: AdVariant) =>
  cn(
    'relative isolate shrink-0 overflow-hidden rounded-t-card',
    variant === 'rail'
      ? 'aspect-[4/5]'
      : 'aspect-[4/3] sm:aspect-video sm:w-3/5 sm:rounded-tr-none sm:rounded-bl-card',
  );

export const adCopyClass = (variant: AdVariant) =>
  cn('flex flex-col gap-3 p-4', variant === 'inline' && 'sm:flex-1 sm:justify-center sm:p-6');

/** `sizes` for poster images in the media box. */
export const adMediaSizes = (variant: AdVariant) =>
  variant === 'rail' ? '240px' : '(min-width: 768px) 60vw, 100vw';

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

/**
 * Fixed ratio (04 §4, no layout shift): 4:5 in the rail; in-feed 4:3, then 16:9 beside the copy.
 * The backdrop is the blush gradient our 4:5 posters and video loop are drawn on.
 */
export const adMediaClass = (variant: AdVariant) =>
  cn(
    'relative isolate shrink-0 overflow-hidden rounded-t-card bg-linear-to-br from-blush-50 to-pink-100',
    variant === 'rail'
      ? 'aspect-[4/5]'
      : 'aspect-[4/3] sm:aspect-video sm:w-3/5 sm:rounded-tr-none sm:rounded-bl-card',
  );

/**
 * A poster or video layer: the 4:5 frame, centred at full height (the whole box in the rail).
 * In the wider in-feed box its sides fade into the backdrop, which is the same gradient but a
 * level or two off where they meet, so the frame never ends on a hard edge.
 */
export const adFrameClass = (variant: AdVariant) =>
  cn(
    'absolute top-0 left-1/2 aspect-[4/5] h-full -translate-x-1/2',
    variant === 'inline' &&
      '[mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]',
  );

export const adCopyClass = (variant: AdVariant) =>
  cn('flex flex-col gap-3 p-4', variant === 'inline' && 'sm:flex-1 sm:justify-center sm:p-6');

/** `sizes` for poster images in their frame (in-feed: 60 % of a 4:3 box, 45 % of a 16:9 one). */
export const adMediaSizes = (variant: AdVariant) =>
  variant === 'rail' ? '240px' : '(min-width: 768px) 30vw, 60vw';

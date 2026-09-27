import { Button, cn, Logo } from '@hb/ui';
import Link from 'next/link';
import { adCardClass, adCopyClass, adMediaClass, type AdVariant } from './ad-layout';

/**
 * Fills an ad slot nobody has booked (docs/p4-home.md §3). It is our own promotion, so it is not
 * labelled Sponsored. Same width and media box as a paid card.
 */
export function HouseAd({ variant, className }: { variant: AdVariant; className?: string }) {
  return (
    <div className={cn(adCardClass(variant), className)}>
      <div className={cn(adMediaClass(variant), 'grid place-items-center bg-grad-pink')}>
        <div aria-hidden className="h-24 sm:h-28">
          <Logo variant="seal" className="h-full" />
        </div>
      </div>
      <div className={adCopyClass(variant)}>
        <p className="eyebrow text-gold-800">Her Beauty Ads</p>
        <p
          className={cn(
            'font-display leading-snug font-medium text-ink-900',
            variant === 'rail' ? 'text-xl' : 'text-2xl',
          )}
        >
          Advertise with Her Beauty
        </p>
        <p className="text-sm text-ink-500">
          Put your products beside the home page&rsquo;s best sections, in 3D or video.
        </p>
        <Button
          asChild
          variant="secondary"
          block={variant === 'rail'}
          className={cn('mt-1', variant === 'inline' && 'self-start')}
        >
          {/* No prefetch until the /advertise page exists (P9). */}
          <Link href="/advertise" prefetch={false}>
            See ad packages
          </Link>
        </Button>
      </div>
    </div>
  );
}

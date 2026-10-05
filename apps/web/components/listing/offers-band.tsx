import { cn } from '@hb/ui';
import { ShieldCheck } from 'lucide-react';
import { productCount } from '@/lib/listing-url';

/**
 * The offers page's intro band (docs/p5-catalog.md §1): a rose-gradient house promotion with the
 * page's H1, not an ad, so no Sponsored label. Same treatment as the home offer banner: a darker
 * wash keeps white text at 4.5:1 across the gradient, and gold rings are the only decoration.
 */
export function OffersBand({ total, className }: { total: number; className?: string }) {
  return (
    <header
      className={cn(
        'relative isolate overflow-hidden rounded-card bg-grad-rose px-6 py-10 text-white shadow-soft sm:px-10 md:py-14',
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 bg-gradient-to-r from-transparent to-pink-700/60"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 -z-10 h-56 w-56 rounded-pill border border-gold-300/50"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-24 right-24 -z-10 h-48 w-48 rounded-pill border border-gold-300/30"
      />
      <p className="eyebrow mb-3 text-pink-100">This week</p>
      <h1 className="font-display text-[34px] font-semibold leading-tight md:text-[56px]">
        Offers
      </h1>
      <p className="mt-3 flex max-w-xl items-start gap-2">
        <ShieldCheck aria-hidden className="mt-1 h-5 w-5 shrink-0 text-gold-300" />
        <span>
          Real savings from verified sellers and official brands, biggest discounts first. Your
          payment is held safely until your parcel arrives.
        </span>
      </p>
      <p className="mt-4 text-sm tabular-nums text-pink-100">{productCount(total)} on sale</p>
    </header>
  );
}

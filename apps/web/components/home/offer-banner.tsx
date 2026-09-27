'use client';

import { Button } from '@hb/ui';
import { ShieldCheck } from 'lucide-react';
import { useInView } from 'motion/react';
import Link from 'next/link';
import { useRef } from 'react';

/**
 * Home §5 (docs/p4-home.md §2): a house promotion, not an ad, so it carries no Sponsored label.
 * A gold shine sweeps across once when the banner scrolls into view and again on each hover.
 * Only transform moves; reduced motion shortens the sweep to nothing (global rule in theme.css).
 */
export function OfferBanner() {
  const ref = useRef<HTMLElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.5 });

  return (
    <section
      ref={ref}
      aria-labelledby="offer-title"
      className="group relative isolate overflow-hidden rounded-card bg-grad-rose px-6 py-10 text-white shadow-soft sm:px-10 sm:py-14"
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 -z-10 -translate-x-[120%] bg-shine opacity-40 ${seen ? 'animate-shimmer' : ''}`}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 -translate-x-[120%] bg-shine opacity-40 group-hover:animate-shimmer"
      />
      {/* Deepens the light end of grad-rose so white text keeps 4.5:1 across the banner. */}
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

      <div className="flex flex-col gap-8 @3xl:flex-row @3xl:items-center @3xl:justify-between">
        <div className="max-w-xl">
          <p className="eyebrow mb-3 text-pink-100">This season</p>
          <h2
            id="offer-title"
            className="font-display text-[28px] font-medium leading-tight sm:text-[36px]"
          >
            Glow for less, from sellers you can trust
          </h2>
          <p className="mt-3 flex items-start gap-2">
            <ShieldCheck aria-hidden className="mt-1 h-5 w-5 shrink-0 text-gold-300" />
            <span>
              Offers from verified sellers and official brands. Your payment is held safely until
              your parcel arrives.
            </span>
          </p>
        </div>
        <Button asChild variant="gold" size="lg" className="self-start @3xl:self-center">
          <Link href="/offers">See today’s offers</Link>
        </Button>
      </div>
    </section>
  );
}

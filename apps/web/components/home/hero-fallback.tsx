import type { HeroScene } from '@hb/types';
import { Button, Container } from '@hb/ui';
import Image from 'next/image';
import Link from 'next/link';
import { SITE } from '@/lib/site';

/**
 * Static hero: server-rendered, the LCP element on every device, and the whole hero for low-tier
 * devices, reduced motion and Save-Data (docs/frontend-plan.md §6 "Tiers").
 */
export function HeroFallback({ scene }: { scene: HeroScene | undefined }) {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden bg-grad-pink">
      {/*
        From 1024 px it fills the first screen below the header, so nothing under the hero is in
        view when the cinematic film replaces it on mid/high tier (no layout shift is counted).
      */}
      <Container
        wide
        className="grid min-h-[80vh] items-center gap-10 py-16 md:min-h-[calc(100svh-6rem)] md:grid-cols-2 md:py-24"
      >
        <div className="relative z-10 max-w-xl animate-rise">
          <p className="eyebrow mb-4 text-gold-800">Her Beauty</p>
          <h1
            id="hero-title"
            className="font-display text-[40px] font-semibold leading-[1.05] text-ink-900 md:text-[72px]"
          >
            <span className="text-grad-rose">{scene?.title ?? SITE.tagline}</span>
          </h1>
          <p className="mt-6 max-w-md text-lg text-ink-500">
            {scene?.subtitle ?? SITE.description}
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/new">Shop new arrivals</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/become-a-seller">Sell on Her Beauty</Link>
            </Button>
          </div>
        </div>
        {scene && (
          <div className="relative aspect-[16/9] w-full md:aspect-[4/3]">
            <Image
              src={scene.poster.url}
              alt={scene.poster.alt}
              fill
              priority
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-contain object-center"
            />
          </div>
        )}
      </Container>
    </section>
  );
}

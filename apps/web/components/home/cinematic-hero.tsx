'use client';

import type { HeroProduct } from '@hb/three/3d';
import { useDeviceTier } from '@hb/three';
import { Badge, Button, Logo } from '@hb/ui';
import { Pause, Play } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';

const HeroScene = dynamic(() => import('@hb/three/3d').then((m) => m.HeroScene), { ssr: false });

export type HeroAd = {
  headline: string;
  sellerName: string;
  href: string;
  ctaLabel: string;
  priceLabel: string | null;
  product: HeroProduct | null;
};

type CinematicHeroProps = {
  title: string;
  subtitle: string;
  ad: HeroAd | null;
  duo: readonly [HeroProduct, HeroProduct];
  orbit: readonly HeroProduct[];
  /** Server-rendered static hero: shown first (LCP) and kept for low tier / reduced motion. */
  fallback: ReactNode;
};

/**
 * 4-scene cinematic hero (docs/frontend-plan.md §6). A tall section with a sticky stage; GSAP
 * ScrollTrigger scrubs the DOM copy and writes progress for the WebGL scene to read each frame.
 */
export function CinematicHero(props: CinematicHeroProps) {
  const tier = useDeviceTier();
  const [idle, setIdle] = useState(false);

  // Mount the heavy stage only once the browser is idle, so it never competes with LCP.
  useEffect(() => {
    if (tier !== 'high' && tier !== 'mid') return;
    const ric = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
    const id = ric(() => setIdle(true));
    return () => (window.cancelIdleCallback ?? window.clearTimeout)(id);
  }, [tier]);

  if ((tier !== 'high' && tier !== 'mid') || !idle) return <>{props.fallback}</>;
  return <Stage {...props} tier={tier} />;
}

function Stage({
  title,
  subtitle,
  ad,
  duo,
  orbit,
  tier,
}: CinematicHeroProps & { tier: 'high' | 'mid' }) {
  const root = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let revert: (() => void) | undefined;
    let cancelled = false;

    void Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(
      ([{ gsap }, { ScrollTrigger }]) => {
        if (cancelled) return;
        gsap.registerPlugin(ScrollTrigger);
        const ctx = gsap.context(() => {
          const q = gsap.utils.selector(el);
          // Scene 1 intro plays on load, not on scroll: the gold rings draw the HB seal.
          gsap
            .timeline({ defaults: { ease: 'power2.out' } })
            .fromTo(
              q('[data-draw]'),
              { strokeDashoffset: 1 },
              { strokeDashoffset: 0, duration: 1.2, stagger: 0.15 },
            )
            .fromTo(
              q('[data-intro]'),
              { autoAlpha: 0, y: 12 },
              { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.12 },
              '-=0.6',
            );

          const tl = gsap.timeline({
            defaults: { ease: 'none' },
            scrollTrigger: {
              trigger: el,
              start: 'top top',
              end: 'bottom bottom',
              scrub: 0.8,
              onUpdate: (self) => {
                progress.current = self.progress;
              },
            },
          });
          // Positions are fractions of the whole hero (timeline length 1).
          tl.to(q('[data-hint]'), { autoAlpha: 0, duration: 0.06 }, 0)
            .to(
              q('[data-scene="logo"]'),
              { scale: 0.45, yPercent: -60, autoAlpha: 0, duration: 0.2 },
              0.2,
            )
            .fromTo(
              q('[data-bg="blush"]'),
              { autoAlpha: 0 },
              { autoAlpha: 1, duration: 0.25 },
              0.25,
            )
            .fromTo(
              q('[data-line]'),
              { autoAlpha: 0, yPercent: 40 },
              { autoAlpha: 1, yPercent: 0, duration: 0.08, stagger: 0.03 },
              0.5,
            )
            .fromTo(q('[data-story-sub]'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.06 }, 0.58)
            .to(q('[data-scene="story"]'), { autoAlpha: 0, yPercent: -20, duration: 0.06 }, 0.74)
            .fromTo(
              q('[data-scene="ad"]'),
              { autoAlpha: 0, y: 30 },
              { autoAlpha: 1, y: 0, duration: 0.1 },
              0.84,
            )
            .to({}, { duration: 0.02 }, 0.98);
        }, el);
        revert = () => ctx.revert();
        ScrollTrigger.refresh();
      },
    );
    return () => {
      cancelled = true;
      revert?.();
    };
  }, []);

  return (
    <section
      ref={root}
      aria-labelledby="hero-title"
      aria-describedby="hero-desc"
      className="relative h-[220vh] animate-fade md:h-[400vh]"
    >
      <div className="sticky top-0 h-[100svh] overflow-hidden bg-white">
        <div data-bg="blush" aria-hidden className="absolute inset-0 bg-grad-pink opacity-0" />

        <HeroScene
          tier={tier}
          progress={progress}
          paused={paused}
          duo={duo}
          orbit={orbit}
          featured={ad?.product ?? null}
          onReady={() => setReady(true)}
          className={`absolute inset-0 transition-opacity duration-cinema ${ready ? 'opacity-100' : 'opacity-0'}`}
        />

        {/* Scene 1 — logo */}
        <div
          data-scene="logo"
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-6"
        >
          <Logo variant="seal" className="h-32 md:h-44" title="Her Beauty" />
          <p data-intro className="eyebrow text-gold-800">
            Her Beauty · Pakistan&rsquo;s beauty marketplace
          </p>
        </div>

        {/* Scene 3 — story. Copy is always in the DOM for screen readers. */}
        <div
          data-scene="story"
          className="pointer-events-none absolute inset-x-0 top-[12vh] px-4 text-center md:top-[14vh]"
        >
          <h1
            id="hero-title"
            className="font-display text-[40px] font-semibold leading-[1.05] md:text-[80px]"
          >
            {title.split(/(?<=,)\s+/).map((line) => (
              <span key={line} data-line className="block text-grad-rose opacity-0">
                {line}
              </span>
            ))}
          </h1>
          <p
            id="hero-desc"
            data-story-sub
            className="mx-auto mt-4 max-w-md text-ink-500 opacity-0 md:text-lg"
          >
            {subtitle}
          </p>
        </div>

        {/* Scene 4 — featured (paid hero ad). CTA is a real link; focusing it reveals the card. */}
        {ad ? (
          <div
            data-scene="ad"
            className="absolute inset-x-4 bottom-20 opacity-0 focus-within:!translate-y-0 focus-within:!opacity-100 focus-within:!visible md:inset-x-auto md:bottom-auto md:left-[max(2rem,calc(50vw-640px))] md:top-1/2 md:w-[340px] md:-translate-y-1/2"
          >
            <div className="rounded-card bg-white/90 p-6 shadow-lift backdrop-blur">
              <div className="flex items-center justify-between gap-2">
                <p className="eyebrow text-gold-800">{ad.sellerName}</p>
                <Badge kind="sponsored" />
              </div>
              <p className="mt-2 font-display text-2xl font-semibold text-ink-900 md:text-3xl">
                {ad.headline}
              </p>
              {ad.priceLabel ? <p className="mt-1 text-lg text-pink-700">{ad.priceLabel}</p> : null}
              <div className="mt-5 flex flex-wrap gap-3">
                <Button asChild>
                  <Link href={ad.href}>{ad.ctaLabel}</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/new">Shop new arrivals</Link>
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <p
          data-hint
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-8 text-center text-xs tracking-[0.2em] text-ink-500 uppercase"
        >
          Scroll to explore
        </p>

        <div className="absolute right-4 bottom-4 flex items-center gap-2 md:right-8 md:bottom-8">
          <a
            href="#after-hero"
            className="rounded-pill bg-white/80 px-4 py-2.5 text-xs font-medium text-ink-900 shadow-soft backdrop-blur transition-colors duration-fast hover:bg-white"
          >
            Skip intro
          </a>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-pressed={paused}
            aria-label={paused ? 'Play hero animation' : 'Pause hero animation'}
            className="grid h-11 w-11 place-items-center rounded-pill bg-white/80 text-ink-900 shadow-soft backdrop-blur transition-colors duration-fast hover:bg-white"
          >
            {paused ? (
              <Play aria-hidden className="h-4 w-4" />
            ) : (
              <Pause aria-hidden className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </section>
  );
}

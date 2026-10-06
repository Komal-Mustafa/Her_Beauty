'use client';

import { cn, usePrefersReducedMotion } from '@hb/ui';
import Image from 'next/image';
import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react';

export type GalleryImage = { id: string; url: string; alt: string };

type GalleryImagesProps = {
  images: readonly GalleryImage[];
  /** Points at the image on show, for the fly-to-cart copy. */
  activeRef: RefObject<HTMLElement | null>;
};

/** The gallery is ~60 % of the 1280 px content width from 1024 px, and full width below. */
const SIZES = '(min-width: 1280px) 740px, (min-width: 1024px) 58vw, 100vw';
const DESKTOP = '(min-width: 64rem)';

function subscribeDesktop(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {};
  const mql = window.matchMedia(DESKTOP);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

/** From 1024 px (one main image, no strip). False on the server: the strip comes first. */
function useDesktop(): boolean {
  return useSyncExternalStore(
    subscribeDesktop,
    () => typeof window.matchMedia === 'function' && window.matchMedia(DESKTOP).matches,
    () => false,
  );
}

/**
 * Product images (docs/p5-catalog.md §5). Below 1024 px: a horizontal scroll-snap strip (native
 * swipe) with dot buttons; from 1024 px: one main image with a row of thumbnail buttons
 * (`aria-pressed`). One list serves both layouts, so no image is downloaded twice. The first
 * image is the page's LCP and loads with priority. The strip is a named list and, while it
 * scrolls, a Tab stop, so keyboard users can scroll it with the arrow keys (the dots also work).
 */
export function GalleryImages({ images, activeRef }: GalleryImagesProps) {
  const [active, setActive] = useState(0);
  const strip = useRef<HTMLUListElement>(null);
  const reduced = usePrefersReducedMotion();
  const desktop = useDesktop();

  // Swiping the strip moves the dots (one rAF per burst of scroll events).
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!el.clientWidth || window.matchMedia(DESKTOP).matches) return;
        setActive(Math.min(images.length - 1, Math.round(el.scrollLeft / el.clientWidth)));
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [images.length]);

  useEffect(() => {
    activeRef.current = (strip.current?.children[active] as HTMLElement | undefined) ?? null;
  }, [active, activeRef]);

  // Crossing into the strip layout (a rotated tablet) shows the image the thumbnails picked.
  useEffect(() => {
    const mql = window.matchMedia(DESKTOP);
    const onChange = () => {
      const el = strip.current;
      if (el && !mql.matches) el.scrollLeft = active * el.clientWidth;
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [active]);

  function show(index: number) {
    setActive(index);
    const el = strip.current;
    if (el && !window.matchMedia(DESKTOP).matches) {
      el.scrollTo({ left: index * el.clientWidth, behavior: reduced ? 'auto' : 'smooth' });
    }
  }

  const many = images.length > 1;

  return (
    <div>
      <ul
        ref={strip}
        aria-label="Product images"
        // A scrolling region must be reachable from the keyboard (WCAG 2.1.1); from 1024 px the list
        // shows one image and does not scroll.
        tabIndex={many && !desktop ? 0 : undefined}
        // Lenis would read a sideways trackpad swipe as page scroll.
        data-lenis-prevent-horizontal
        className={cn(
          'flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-card',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:overflow-visible',
        )}
      >
        {images.map((image, i) => (
          <li
            key={image.id}
            className={cn(
              'relative aspect-[4/5] w-full shrink-0 snap-center overflow-hidden rounded-card bg-blush-50',
              i !== active && 'md:hidden',
            )}
          >
            <Image
              src={image.url}
              alt={image.alt}
              fill
              sizes={SIZES}
              priority={i === 0}
              className="object-cover"
            />
          </li>
        ))}
      </ul>

      {many ? (
        <div className="mt-2 flex justify-center md:hidden">
          {images.map((image, i) => (
            <button
              key={image.id}
              type="button"
              aria-label={`Show image ${i + 1} of ${images.length}`}
              aria-current={i === active || undefined}
              onClick={() => show(i)}
              className="group/dot grid h-11 w-11 place-items-center rounded-pill"
            >
              <span
                aria-hidden
                className={cn(
                  'h-2 w-2 rounded-pill transition duration-base ease-soft',
                  i === active ? 'scale-125 bg-pink-600' : 'bg-ink-200 group-hover/dot:bg-pink-200',
                )}
              />
            </button>
          ))}
        </div>
      ) : null}

      {many ? (
        <div className="mt-4 hidden flex-wrap gap-3 md:flex">
          {images.map((image, i) => (
            <button
              key={image.id}
              type="button"
              aria-pressed={i === active}
              onClick={() => show(i)}
              className={cn(
                'relative aspect-[4/5] w-20 overflow-hidden rounded-btn border-2 bg-blush-50 transition-colors duration-fast ease-soft',
                i === active ? 'border-pink-600' : 'border-transparent hover:border-pink-200',
              )}
            >
              <Image src={image.url} alt={image.alt} fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

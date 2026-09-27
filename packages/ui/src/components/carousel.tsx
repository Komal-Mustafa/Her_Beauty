'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { prefersReducedMotion } from '../hooks/use-reduced-motion';
import { cn } from '../lib/cn';

type CarouselProps = {
  /** Accessible name of the carousel, e.g. "Trending now". */
  label: string;
  children: ReactNode;
  /** Shown left of the prev/next buttons (e.g. a `SectionHeading` with `className="mb-0"`). */
  header?: ReactNode;
  /** Slide widths. Default: 1.4 → 2.2 → 3.2 → 4 cards per view. */
  itemClassName?: string;
  prevLabel?: string;
  nextLabel?: string;
  className?: string;
};

/** A press must travel this far (px) before it becomes a drag, so plain clicks stay clicks. */
const DRAG_THRESHOLD = 6;
/** Inertia: velocity kept per 16 ms frame, and the speed (px/ms) where it stops. */
const FRICTION = 0.94;
const MIN_SPEED = 0.03;
/** A release after holding still this long (ms) throws nothing. */
const HOLD_MS = 80;

// Gaps are 16 px, then 24 px from md (1024), so four slides fill (100% - 3 × 24 px) / 4.
const DEFAULT_ITEM = 'w-[70%] xs:w-[44%] sm:w-[30%] md:w-[calc((100%-4.5rem)/4)]';

/**
 * Horizontal carousel (docs/p4-home.md §5): CSS scroll-snap on a native scroller, so touch keeps
 * the platform's own swipe and inertia; mouse drag adds inertia with rAF decay (cancelled by
 * wheel, keys or touch) and swallows the click that ends a drag; prev/next page by whole items
 * and are disabled at the ends. No autoplay.
 */
export function Carousel({
  label,
  children,
  header,
  itemClassName = DEFAULT_ITEM,
  prevLabel = 'Previous',
  nextLabel = 'Next',
  className,
}: CarouselProps) {
  const trackId = useId();
  const trackRef = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const updateEdges = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const start = el.scrollLeft <= 1;
    const end = el.scrollLeft >= el.scrollWidth - el.clientWidth - 1;
    setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    updateEdges();
    el.addEventListener('scroll', updateEdges, { passive: true });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateEdges);
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', updateEdges);
      ro?.disconnect();
    };
  }, [updateEdges]);

  useEffect(() => {
    const el = trackRef.current;
    if (el) return enableMouseDrag(el);
  }, []);

  function page(dir: 1 | -1) {
    const el = trackRef.current;
    if (!el || (dir < 0 ? edges.start : edges.end)) return;
    el.scrollTo({
      left: pageTarget(el, dir),
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  }

  const items = Children.toArray(children).filter(isValidElement);

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      className={cn('min-w-0', className)}
    >
      <div className="mb-2 flex items-end justify-between gap-4">
        <div className="min-w-0">{header}</div>
        <div className="flex shrink-0 gap-2">
          <ArrowButton
            label={prevLabel}
            controls={trackId}
            disabled={edges.start}
            onClick={() => page(-1)}
          >
            <ChevronLeft aria-hidden className="h-5 w-5" />
          </ArrowButton>
          <ArrowButton
            label={nextLabel}
            controls={trackId}
            disabled={edges.end}
            onClick={() => page(1)}
          >
            <ChevronRight aria-hidden className="h-5 w-5" />
          </ArrowButton>
        </div>
      </div>
      {/*
        data-lenis-prevent-horizontal: Lenis (smooth scroll) would take a trackpad swipe, which
        always has some vertical delta, for the page; mostly-sideways wheels stay native here.
        The padding is room for the lifted card's shadow, given back with negative margins; the
        track is not positioned, so that overhang never sits above the content around it.
      */}
      <ul
        ref={trackRef}
        id={trackId}
        data-lenis-prevent-horizontal
        className={cn(
          'flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain md:gap-6',
          '-mx-4 scroll-px-4 px-4 md:-mx-6 md:scroll-px-6 md:px-6 -mb-8 pb-14 pt-3',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          'data-[dragging=true]:cursor-grabbing data-[dragging=true]:select-none data-[dragging=true]:[&>li]:pointer-events-none',
        )}
      >
        {items.map((child, i) => (
          <li key={child.key ?? i} className={cn('shrink-0 snap-start', itemClassName)}>
            {child}
          </li>
        ))}
      </ul>
    </div>
  );
}

type ArrowButtonProps = {
  label: string;
  controls: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
};

// aria-disabled (not disabled) keeps focus on the button when paging reaches the end.
function ArrowButton({ label, controls, disabled, onClick, children }: ArrowButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-controls={controls}
      aria-disabled={disabled}
      onClick={onClick}
      className={cn(
        'grid h-11 w-11 place-items-center rounded-pill border bg-white transition duration-fast ease-soft',
        disabled
          ? 'cursor-default border-ink-200 text-ink-500 opacity-50'
          : 'border-ink-200 text-ink-900 hover:border-pink-600 hover:text-pink-600 active:scale-95 motion-reduce:active:scale-100',
      )}
    >
      {children}
    </button>
  );
}

/** A slide's left edge in the track's scroll coordinates (the track is not an offsetParent). */
function slideLeft(el: HTMLElement, item: HTMLElement): number {
  const track = el.getBoundingClientRect();
  return item.getBoundingClientRect().left - track.left - el.clientLeft + el.scrollLeft;
}

/** Left scroll offset that aligns a slide with the snap edge. */
function snapLeft(el: HTMLElement, item: HTMLElement): number {
  const pad = Number.parseFloat(getComputedStyle(el).scrollPaddingLeft) || 0;
  return slideLeft(el, item) - pad;
}

function clampScroll(el: HTMLElement, left: number): number {
  return Math.max(0, Math.min(left, el.scrollWidth - el.clientWidth));
}

/** Next page starts at the first slide cut off on the right; previous page ends where this one starts. */
function pageTarget(el: HTMLElement, dir: 1 | -1): number {
  const items = Array.from(el.children) as HTMLElement[];
  if (dir > 0) {
    const edge = el.scrollLeft + el.clientWidth;
    const next = items.find((li) => slideLeft(el, li) + li.offsetWidth > edge + 1);
    return clampScroll(el, next ? snapLeft(el, next) : el.scrollWidth);
  }
  const target = el.scrollLeft - el.clientWidth;
  const prev = items.find((li) => snapLeft(el, li) >= target - 1);
  return clampScroll(el, prev ? snapLeft(el, prev) : 0);
}

function nearestSnap(el: HTMLElement, left: number): number {
  let best = left;
  let bestDistance = Infinity;
  for (const li of Array.from(el.children) as HTMLElement[]) {
    const x = clampScroll(el, snapLeft(el, li));
    if (Math.abs(x - left) < bestDistance) {
      best = x;
      bestDistance = Math.abs(x - left);
    }
  }
  return best;
}

type Drag = {
  id: number;
  startX: number;
  startLeft: number;
  lastX: number;
  lastT: number;
  v: number;
  moved: boolean;
};

/**
 * Mouse drag-to-scroll with inertia. Snapping is off while the mouse or the throw moves the
 * track (a snapping scroller would fight every scrollLeft write) and comes back once it settles.
 * Returns the cleanup.
 */
function enableMouseDrag(el: HTMLElement): () => void {
  let drag: Drag | null = null;
  let frame = 0;
  let settleTimer = 0;
  let swallowClick = false;

  const snapOff = () => {
    window.clearTimeout(settleTimer);
    el.style.scrollSnapType = 'none';
  };
  const settle = () => {
    const reduce = prefersReducedMotion();
    el.scrollTo({ left: nearestSnap(el, el.scrollLeft), behavior: reduce ? 'auto' : 'smooth' });
    // Snapping returns once the settle scroll is done (no `scrollend` in older Safari).
    settleTimer = window.setTimeout(() => (el.style.scrollSnapType = ''), reduce ? 0 : 400);
  };
  const stopThrow = () => {
    if (!frame) return false;
    cancelAnimationFrame(frame);
    frame = 0;
    return true;
  };

  const onMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.startX;
    if (!drag.moved) {
      if (Math.abs(dx) < DRAG_THRESHOLD) return;
      drag.moved = true;
      snapOff();
      el.dataset.dragging = 'true';
    }
    const dt = Math.max(1, e.timeStamp - drag.lastT);
    drag.v = 0.8 * ((e.clientX - drag.lastX) / dt) + 0.2 * drag.v;
    drag.lastX = e.clientX;
    drag.lastT = e.timeStamp;
    el.scrollLeft = drag.startLeft - dx;
  };

  const onUp = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    const { moved, lastT } = drag;
    let v = e.timeStamp - lastT > HOLD_MS ? 0 : drag.v;
    drag = null;
    delete el.dataset.dragging;
    if (!moved) {
      if (el.style.scrollSnapType === 'none') settle();
      return;
    }
    // The click that ends a drag must not open the card under the pointer.
    swallowClick = true;
    window.setTimeout(() => (swallowClick = false), 0);
    if (prefersReducedMotion() || Math.abs(v) < MIN_SPEED) return settle();
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      v *= FRICTION ** (dt / 16);
      const before = el.scrollLeft;
      el.scrollLeft = before - v * dt;
      if (Math.abs(v) < MIN_SPEED || el.scrollLeft === before) {
        frame = 0;
        settle();
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  };

  const onDown = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    stopThrow();
    drag = {
      id: e.pointerId,
      startX: e.clientX,
      startLeft: el.scrollLeft,
      lastX: e.clientX,
      lastT: e.timeStamp,
      v: 0,
      moved: false,
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const onClick = (e: MouseEvent) => {
    if (!swallowClick) return;
    swallowClick = false;
    e.preventDefault();
    e.stopPropagation();
  };
  // Wheel, keys and touch take over from a throw at once.
  const interrupt = () => {
    if (stopThrow()) settle();
  };
  const noNativeDrag = (e: DragEvent) => e.preventDefault();

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('click', onClick, true);
  el.addEventListener('dragstart', noNativeDrag);
  el.addEventListener('wheel', interrupt, { passive: true });
  el.addEventListener('keydown', interrupt);
  el.addEventListener('touchstart', interrupt, { passive: true });
  return () => {
    stopThrow();
    window.clearTimeout(settleTimer);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('click', onClick, true);
    el.removeEventListener('dragstart', noNativeDrag);
    el.removeEventListener('wheel', interrupt);
    el.removeEventListener('keydown', interrupt);
    el.removeEventListener('touchstart', interrupt);
  };
}

'use client';

import { Pause, Play } from 'lucide-react';
import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
} from 'react';
import { usePrefersReducedMotion } from '../hooks/use-reduced-motion';
import { cn } from '../lib/cn';

type MarqueeProps = {
  /** Accessible name of the list, e.g. "Official brands". */
  label: string;
  children: ReactNode;
  /** Scroll speed in px per second. */
  speed?: number;
  /** Space between items (the loop seam uses the same space). */
  gap?: 'sm' | 'md' | 'lg';
  /** Visible Pause/Play button (WCAG 2.2.2 for content that moves on its own). */
  pauseButton?: boolean;
  pauseLabel?: string;
  playLabel?: string;
  className?: string;
};

type PauseReason = 'hover' | 'focus' | 'user' | 'offscreen';
type Loop = {
  animation: Animation;
  /** Width of one copy of the list: the loop's length. */
  distance: number;
  duration: number;
  /** How far in from the strip's edges a keyboard-focused item is placed (see `focusInset`). */
  inset: number;
};

const GAPS = { sm: 'gap-4 pr-4', md: 'gap-8 pr-8', lg: 'gap-12 pr-12' } as const;
/** The edge fade's share of the strip's width: keep in step with the mask below (8 % / 92 %). */
const FADE = 0.08;
/** Room for the focus ring (2 px at a 2 px offset) and a little air past the fade. */
const RING_ROOM = 8;

/**
 * Endless horizontal strip (docs/p4-home.md §5). The items are rendered once for assistive tech
 * and keyboard, then repeated (`aria-hidden` + `inert`) until the strip is at least twice the
 * viewport, plus one copy hung off its left edge; one Web Animation translates the whole track by
 * one copy (transform only), so the loop has no seam and no layout work. Pauses while hovered,
 * while something inside has focus, while off screen, and from its Pause button. Reduced motion:
 * no animation, one static wrapped row.
 */
export function Marquee({
  label,
  children,
  speed = 40,
  gap = 'md',
  pauseButton = true,
  pauseLabel = 'Pause scrolling',
  playLabel = 'Play scrolling',
  className,
}: MarqueeProps) {
  const reduce = usePrefersReducedMotion();
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const loop = useRef<Loop | null>(null);
  const reasons = useRef(new Set<PauseReason>());
  const [copies, setCopies] = useState(1);
  const [userPaused, setUserPaused] = useState(false);

  const setPaused = useCallback((reason: PauseReason, on: boolean) => {
    if (on) reasons.current.add(reason);
    else reasons.current.delete(reason);
    const animation = loop.current?.animation;
    if (!animation) return;
    if (reasons.current.size) animation.pause();
    else animation.play();
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    const list = listRef.current;
    if (reduce || !viewport || !track || !list || typeof track.animate !== 'function') return;

    const build = () => {
      const distance = list.offsetWidth;
      if (!distance) return;
      const width = viewport.clientWidth;
      setCopies(Math.max(1, Math.ceil(width / distance)));
      const prev = loop.current;
      const duration = (distance / speed) * 1000;
      const inset = Math.min(distance, focusInset(width));
      if (
        prev &&
        prev.distance === distance &&
        prev.duration === duration &&
        prev.inset === inset
      ) {
        return;
      }
      // Carry on from the same place; the first run starts where the server left the list.
      const offset = prev ? (offsetOf(prev) / prev.distance) * distance : 0;
      prev?.animation.cancel();
      // The loop runs over offsets [-inset, distance - inset): the copy hung off the left edge
      // fills the first `inset` px, so even the first item can be focused clear of the fade.
      // A marquee is the one place motion must be linear: any easing would stutter at the seam.
      const animation = track.animate(
        [
          { transform: `translateX(${inset}px)` },
          { transform: `translateX(${inset - distance}px)` },
        ],
        { duration, iterations: Infinity, easing: 'linear' },
      );
      loop.current = { animation, distance, duration, inset };
      seek(loop.current, offset);
      if (reasons.current.size) animation.pause();
    };

    build();
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(build);
    resize?.observe(list);
    resize?.observe(viewport);
    const visible =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver((entries) =>
            setPaused('offscreen', !entries.some((e) => e.isIntersecting)),
          );
    visible?.observe(viewport);
    return () => {
      resize?.disconnect();
      visible?.disconnect();
      loop.current?.animation.cancel();
      loop.current = null;
    };
  }, [reduce, speed, setPaused]);

  // Focus stops the strip; keyboard focus also brings the item out of the edge fade, ring and
  // all. Not a mouse press (it focuses the link too): moving the item then would lose the click.
  function onFocus(e: FocusEvent<HTMLDivElement>) {
    setPaused('focus', true);
    const current = loop.current;
    const viewport = viewportRef.current;
    const target = e.target instanceof Element ? e.target : null;
    if (!current || !viewport || !target || !isFocusVisible(target)) return;
    const item = target.closest('li');
    if (!item) return;
    const box = viewport.getBoundingClientRect();
    const rect = item.getBoundingClientRect();
    const { inset } = current;
    if (rect.left >= box.left + inset && rect.right <= box.right - inset) return;
    // The item's offset in the track, less the inset, is the offset that puts it at the inset.
    seek(current, offsetOf(current) + rect.left - box.left - inset);
  }

  function onBlur(e: FocusEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused('focus', false);
  }

  function toggleUserPause() {
    const next = !userPaused;
    setUserPaused(next);
    setPaused('user', next);
  }

  const items = Children.toArray(children).filter(isValidElement);
  const renderItems = (copy: number | string) =>
    items.map((child, i) => (
      <li key={`${copy}-${child.key ?? i}`} className="shrink-0">
        {child}
      </li>
    ));

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        ref={viewportRef}
        onMouseEnter={() => setPaused('hover', true)}
        onMouseLeave={() => setPaused('hover', false)}
        onFocus={onFocus}
        onBlur={onBlur}
        className={cn(
          // clip (not hidden): the browser must never scroll the strip itself to reveal focus.
          'min-w-0 flex-1 overflow-clip py-2',
          '[mask-image:linear-gradient(90deg,transparent,var(--color-white)_8%,var(--color-white)_92%,transparent)] motion-reduce:[mask-image:none]',
        )}
      >
        <div ref={trackRef} className="relative flex w-max motion-reduce:w-full">
          <ul
            aria-hidden
            inert
            className={cn(
              'absolute inset-y-0 right-full flex w-max items-center',
              GAPS[gap],
              'motion-reduce:hidden',
            )}
          >
            {renderItems('lead')}
          </ul>
          <ul
            ref={listRef}
            aria-label={label}
            className={cn(
              'flex shrink-0 items-center',
              GAPS[gap],
              'motion-reduce:w-full motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:pr-0',
            )}
          >
            {renderItems(0)}
          </ul>
          {Array.from({ length: copies }, (_, c) => (
            <ul
              key={c}
              aria-hidden
              inert
              className={cn('flex shrink-0 items-center', GAPS[gap], 'motion-reduce:hidden')}
            >
              {renderItems(c + 1)}
            </ul>
          ))}
        </div>
      </div>
      {pauseButton && (
        <button
          type="button"
          onClick={toggleUserPause}
          aria-label={userPaused ? playLabel : pauseLabel}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-pill border border-ink-200 bg-white text-ink-900 transition duration-fast ease-soft hover:border-pink-600 hover:text-pink-600 motion-reduce:hidden"
        >
          {userPaused ? (
            <Play aria-hidden className="h-4 w-4" />
          ) : (
            <Pause aria-hidden className="h-4 w-4" />
          )}
        </button>
      )}
    </div>
  );
}

/** Just past the edge fade, with room for the focus ring. */
function focusInset(width: number): number {
  return Math.ceil(width * FADE) + RING_ROOM;
}

/** Where the strip's left edge is (px from the original list's start): -inset ≤ x < distance - inset. */
function offsetOf(loop: Loop): number {
  const time = Number(loop.animation.currentTime ?? 0);
  return ((time % loop.duration) / loop.duration) * loop.distance - loop.inset;
}

/** Moves the loop so the strip's left edge is at `offset` (taken modulo one copy). */
function seek(loop: Loop, offset: number): void {
  const within = (((offset + loop.inset) % loop.distance) + loop.distance) % loop.distance;
  loop.animation.currentTime = (within / loop.distance) * loop.duration;
}

function isFocusVisible(el: Element): boolean {
  try {
    return el.matches(':focus-visible');
  } catch {
    // An engine without :focus-visible: treat all focus as keyboard focus.
    return true;
  }
}

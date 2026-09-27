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
type Loop = { animation: Animation; distance: number; duration: number };

const GAPS = { sm: 'gap-4 pr-4', md: 'gap-8 pr-8', lg: 'gap-12 pr-12' } as const;

/**
 * Endless horizontal strip (docs/p4-home.md §5). The items are rendered once for assistive tech
 * and keyboard, then repeated (`aria-hidden` + `inert`) until the strip is at least twice the
 * viewport; one Web Animation translates the whole track by one copy (transform only), so the loop
 * has no seam and no layout work. Pauses while hovered, while something inside has focus, while
 * off screen, and from its Pause button. Reduced motion: no animation, one static wrapped row.
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
      setCopies(Math.max(1, Math.ceil(viewport.clientWidth / distance)));
      const prev = loop.current;
      const duration = (distance / speed) * 1000;
      if (prev && prev.distance === distance && prev.duration === duration) return;
      const progress = prev ? progressOf(prev) / prev.distance : 0;
      prev?.animation.cancel();
      // A marquee is the one place motion must be linear: any easing would stutter at the seam.
      const animation = track.animate(
        [{ transform: 'translateX(0)' }, { transform: `translateX(${-distance}px)` }],
        { duration, iterations: Infinity, easing: 'linear' },
      );
      animation.currentTime = progress * duration;
      loop.current = { animation, distance, duration };
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

  // Keyboard focus stops the strip and brings the focused item fully into view.
  function onFocus(e: FocusEvent<HTMLDivElement>) {
    setPaused('focus', true);
    const current = loop.current;
    const viewport = viewportRef.current;
    const item = e.target instanceof Element ? e.target.closest('li') : null;
    if (!current || !viewport || !item) return;
    const box = viewport.getBoundingClientRect();
    const rect = item.getBoundingClientRect();
    const margin = Math.min(48, box.width * 0.1);
    if (rect.left >= box.left + margin && rect.right <= box.right - margin) return;
    const position = rect.left - box.left + progressOf(current);
    const next = Math.max(0, Math.min(current.distance, position - margin));
    current.animation.currentTime = (next / current.distance) * current.duration;
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
  const renderItems = (copy: number) =>
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
        <div ref={trackRef} className="flex w-max motion-reduce:w-full">
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

/** How far (px) the loop has travelled within the current copy. */
function progressOf(loop: Loop): number {
  const time = Number(loop.animation.currentTime ?? 0);
  return ((time % loop.duration) / loop.duration) * loop.distance;
}

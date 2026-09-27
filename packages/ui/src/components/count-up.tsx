'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { prefersReducedMotion } from '../hooks/use-reduced-motion';
import { cn } from '../lib/cn';
import { easeSoft } from '../lib/ease';

type CountUpProps = {
  /** Final whole number. */
  value: number;
  prefix?: string;
  suffix?: string;
  /** Number grouping locale. */
  locale?: string;
  durationMs?: number;
  className?: string;
};

/**
 * Counts up to `value` once, when it first scrolls into view (rAF, ease-soft, ~1.2 s).
 *
 * The server renders the final value, so no-JS visitors, crawlers and screen readers (which
 * only ever read the visually hidden final text) get the real number. An invisible copy of the
 * final value holds the width, so counting never shifts the layout. Already on screen when the
 * page loads, or reduced motion: the final value stays as it is.
 */
export function CountUp({
  value,
  prefix = '',
  suffix = '',
  locale = 'en-PK',
  durationMs = 1200,
  className,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);
  const format = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
    [locale],
  );

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      setShown(value);
      return;
    }
    let frame = 0;
    let first = true;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting);
        if (first) {
          first = false;
          // Below the fold: reset to zero out of sight. On screen already: keep the final value.
          if (visible) {
            observer.disconnect();
            setShown(value);
          } else setShown(0);
          return;
        }
        if (!visible) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / durationMs);
          setShown(Math.round(value * easeSoft(t)));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, durationMs]);

  const final = `${prefix}${format.format(value)}${suffix}`;
  return (
    <span
      ref={ref}
      className={cn('relative inline-block whitespace-nowrap tabular-nums lining-nums', className)}
    >
      <span aria-hidden className="invisible">
        {final}
      </span>
      <span aria-hidden className="absolute inset-0 text-right">
        {prefix}
        {format.format(shown)}
        {suffix}
      </span>
      <span className="sr-only">{final}</span>
    </span>
  );
}

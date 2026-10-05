'use client';

import type { PkCity } from '@hb/types';
import { ChevronDown, Truck } from 'lucide-react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { setCity, useCity } from '@/lib/city-store';
import {
  CITY_GROUPS,
  deliveryDays,
  deliveryTerms,
  type DeliveryEstimateResult,
} from './delivery-text';

/** An answer faster than this simply appears; a slower one shows "Checking…" first. */
export const LOADING_TEXT_DELAY_MS = 100;

type DeliveryPanelProps = {
  productSlug: string;
  /** The `deliveryEstimate` server action (a prop, so tests can pass their own). */
  getEstimate: (productSlug: string, city: PkCity) => Promise<DeliveryEstimateResult>;
};

/** One request: the city and how many times the shopper has chosen or retried. */
type Answer = { key: string; result: DeliveryEstimateResult };

/**
 * "Delivery to [city ▾]" under Add to cart (docs/p5-catalog.md §5 "Delivery estimate"): a native
 * select of the listed cities by province, remembered in `hb_city_v1`, and the estimate for the
 * chosen city from a server action. The result line is a polite live region with room reserved
 * for two lines, so answers neither jump the layout nor go unannounced. A failure says so and
 * offers a retry; the rest of the page is unaffected.
 */
export function DeliveryPanel({ productSlug, getEstimate }: DeliveryPanelProps) {
  const id = useId();
  const city = useCity();
  // Bumped by every choice and retry, so each one is a new request even for the same city.
  const [attempt, setAttempt] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [slowKey, setSlowKey] = useState<string | null>(null);
  const key = city ? `${city}#${attempt}` : null;

  useEffect(() => {
    if (!city || !key) return;
    let current = true;
    const timer = window.setTimeout(() => setSlowKey(key), LOADING_TEXT_DELAY_MS);
    const settle = (result: DeliveryEstimateResult) => {
      window.clearTimeout(timer);
      if (current) setAnswer({ key, result });
    };
    getEstimate(productSlug, city).then(settle, () => settle({ ok: false }));
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [city, key, productSlug, getEstimate]);

  // Until the answer for this request arrives: "Checking…" once it is slow, before that the
  // previous answer (or nothing), so a quick answer replaces it without a flash.
  const settled = answer?.key === key ? answer.result : null;
  const shown: DeliveryEstimateResult | 'prompt' | 'loading' | null = !city
    ? 'prompt'
    : (settled ?? (slowKey === key ? 'loading' : (answer?.result ?? null)));

  let line: ReactNode = null;
  if (shown === 'prompt') line = 'Choose your city to see delivery time and cost.';
  else if (shown === 'loading') line = `Checking delivery to ${city}…`;
  else if (shown?.ok) {
    line = (
      <>
        <span className="font-medium text-ink-900">{deliveryDays(shown.estimate)}</span>
        {` · ${deliveryTerms(shown.estimate).join(' · ')}`}
      </>
    );
  } else if (shown) line = 'We couldn’t get an estimate right now.';

  return (
    <div className="rounded-card border border-ink-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Truck aria-hidden className="h-6 w-6 shrink-0 text-gold-600" strokeWidth={1.5} />
        <label htmlFor={id} className="text-sm font-medium text-ink-900">
          Delivery to
        </label>
        <div className="relative min-w-0 flex-1 sm:max-w-60">
          <select
            id={id}
            value={city ?? ''}
            onChange={(e) => {
              if (setCity(e.target.value)) setAttempt((n) => n + 1);
            }}
            aria-describedby={`${id}-result`}
            className="h-11 w-full cursor-pointer appearance-none rounded-btn border border-ink-200 bg-white pl-3 pr-9 text-[15px] text-ink-900 transition duration-fast ease-soft hover:border-pink-600 focus:border-pink-600"
          >
            <option value="" disabled>
              Choose your city
            </option>
            {CITY_GROUPS.map((group) => (
              <optgroup key={group.province} label={group.label}>
                {group.cities.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <ChevronDown
            aria-hidden
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500"
          />
        </div>
      </div>
      <div className="mt-3 flex min-h-10 flex-wrap items-start gap-x-3">
        <p id={`${id}-result`} role="status" className="text-sm leading-5 text-ink-500">
          {line}
        </p>
        {shown !== null && typeof shown === 'object' && !shown.ok ? (
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="-my-3 min-h-11 text-sm font-medium text-pink-700 underline underline-offset-4 hover:text-pink-600"
          >
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}

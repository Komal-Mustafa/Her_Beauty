import { useSyncExternalStore } from 'react';
import * as z from 'zod/mini';
import { createLocalStore } from './local-store';

/*
 * The shopper's delivery city for estimates (docs/p5-catalog.md §5 "Delivery estimate"),
 * remembered per browser. Stored as a plain, validated name for now; the delivery estimate checks
 * it against the list of cities it serves (`PkCity`) before asking for an estimate.
 */

export const CITY_STORAGE_KEY = 'hb_city_v1';
export const MAX_CITY_LENGTH = 40;

/** Letters (any script), then letters, spaces, dots, apostrophes or hyphens, e.g. "Dera Ismail Khan". */
const CITY_PATTERN = /^\p{L}[\p{L}\p{M} .'-]*$/u;

const StoredCity = z
  .string()
  .check(z.trim(), z.minLength(1), z.maxLength(MAX_CITY_LENGTH), z.regex(CITY_PATTERN));

/** Untrusted input → a clean city name, or null. */
export function parseCity(value: unknown): string | null {
  const parsed = StoredCity.safeParse(value);
  return parsed.success ? parsed.data.replace(/\s+/g, ' ') : null;
}

const store = createLocalStore<string | null>({
  key: CITY_STORAGE_KEY,
  empty: null,
  parse: parseCity,
});

/** The remembered city; null on the server, during hydration and when none is saved. */
export function useCity(): string | null {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}

/** Remembers the city. Returns false (and keeps the old one) when the name is not valid. */
export function setCity(city: string): boolean {
  const clean = parseCity(city);
  if (clean === null) return false;
  store.update((current) => (current === clean ? current : clean));
  return true;
}

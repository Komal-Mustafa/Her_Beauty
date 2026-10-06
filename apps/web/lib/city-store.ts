import { PkCity } from '@hb/types';
import { useSyncExternalStore } from 'react';
import { createLocalStore } from './local-store';

/*
 * The shopper's delivery city for estimates (docs/p5-catalog.md §5 "Delivery estimate"),
 * remembered per browser. Only a city the estimate serves (`PkCity`) is kept: a stored name from
 * before the list, or an edited one, reads as no city, so the shopper is asked to choose again.
 */

export const CITY_STORAGE_KEY = 'hb_city_v1';

/** Untrusted input → a listed city, or null. */
export function parseCity(value: unknown): PkCity | null {
  const parsed = PkCity.safeParse(value);
  return parsed.success ? parsed.data : null;
}

const store = createLocalStore<PkCity | null>({
  key: CITY_STORAGE_KEY,
  empty: null,
  parse: parseCity,
});

/** The remembered city; null on the server, during hydration and when none is saved. */
export function useCity(): PkCity | null {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}

/** Remembers the city. Returns false (and keeps the old one) when it is not a listed city. */
export function setCity(city: string): boolean {
  const clean = parseCity(city);
  if (clean === null) return false;
  store.update((current) => (current === clean ? current : clean));
  return true;
}

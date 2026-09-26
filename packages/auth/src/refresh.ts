// Single-flight refresh. Refresh tokens rotate on every use and a reused token revokes every
// session of the user (docs/b2-auth.md §2), so two concurrent refreshes with the same token would
// log the person out everywhere. Within one server process, callers presenting the same token
// share one API call, and for a short grace window afterwards receive the same new pair (covers
// requests that left the browser before the new cookies arrived). Edge-safe.
import type { TokenPair } from '@hb/types';

type Entry = { promise: Promise<TokenPair>; settledAt?: number };

export const REFRESH_GRACE_MS = 10_000;
const MAX_ENTRIES = 1_000;

const entries = new Map<string, Entry>();

function prune(now: number): void {
  for (const [key, entry] of entries) {
    if (entry.settledAt !== undefined && now - entry.settledAt > REFRESH_GRACE_MS) {
      entries.delete(key);
    }
  }
  // Hard cap: drop the oldest insertions first (Map keeps insertion order).
  while (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next();
    if (oldest.done) break;
    entries.delete(oldest.value);
  }
}

export function refreshOnce(
  refreshToken: string,
  run: () => Promise<TokenPair>,
  now: () => number = Date.now,
): Promise<TokenPair> {
  prune(now());
  const existing = entries.get(refreshToken);
  if (existing) return existing.promise;

  const entry: Entry = { promise: run() };
  entries.set(refreshToken, entry);
  entry.promise.then(
    () => {
      entry.settledAt = now();
    },
    () => {
      // A failed refresh is not shared: the next caller asks the API again.
      entries.delete(refreshToken);
    },
  );
  return entry.promise;
}

/** Test helper. */
export function resetRefreshCache(): void {
  entries.clear();
}

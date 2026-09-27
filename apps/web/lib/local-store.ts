/**
 * A tiny external store over one localStorage key, for `useSyncExternalStore` (cart and wishlist
 * until their APIs exist, docs/p4-home.md §4).
 *
 * - Storage is untrusted input: every raw value goes through `parse` (zod in the callers), and a
 *   value that fails becomes `empty`.
 * - Every storage access is wrapped: private mode, blocked cookies or a full quota only mean the
 *   state lives in memory for this tab.
 * - Other tabs stay in sync through the `storage` event.
 * - The server snapshot is always `empty`, so server HTML and the first client render match.
 */
export type LocalStore<T> = {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => T;
  getServerSnapshot: () => T;
  /** Replaces the value with `update(current)`; the same reference means "no change". */
  update: (update: (current: T) => T) => void;
};

type Options<T> = {
  key: string;
  empty: T;
  /** Turns an unknown JSON value into a trusted one, or `empty`. Must not throw. */
  parse: (value: unknown) => T;
};

export function createLocalStore<T>({ key, empty, parse }: Options<T>): LocalStore<T> {
  let current: T | undefined;
  const listeners = new Set<() => void>();

  const decode = (raw: string | null): T => {
    if (raw === null) return empty;
    try {
      return parse(JSON.parse(raw));
    } catch {
      return empty;
    }
  };

  const read = (): T => {
    try {
      return decode(window.localStorage.getItem(key));
    } catch {
      return empty;
    }
  };

  const emit = () => listeners.forEach((l) => l());

  const onStorage = (e: StorageEvent) => {
    // `key === null` means another tab cleared all of localStorage.
    if (e.key !== null && e.key !== key) return;
    current = e.key === null ? read() : decode(e.newValue);
    emit();
  };

  let listening = false;

  return {
    subscribe(onChange) {
      // Stays attached for the page's life, so the cached value can never go stale between
      // one subscriber leaving and the next arriving.
      if (!listening) {
        window.addEventListener('storage', onStorage);
        listening = true;
      }
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    getSnapshot() {
      current ??= read();
      return current;
    },
    getServerSnapshot() {
      return empty;
    },
    update(update) {
      const prev = current ?? read();
      const next = update(prev);
      if (next === prev) return;
      current = next;
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Quota or blocked storage: keep the in-memory value for this tab.
      }
      emit();
    },
  };
}

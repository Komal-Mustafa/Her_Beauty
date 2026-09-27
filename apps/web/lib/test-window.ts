/**
 * A minimal `window` for store tests in plain Node: localStorage that can be made to throw
 * (private mode, quota) and a way to deliver another tab's `storage` event.
 */
export function fakeWindow(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const fail = { get: false, set: false };
  const target = new EventTarget();
  const localStorage = {
    getItem(key: string) {
      if (fail.get) throw new Error('SecurityError: storage is blocked');
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      if (fail.set) throw new Error('QuotaExceededError');
      data.set(key, String(value));
    },
    removeItem(key: string) {
      data.delete(key);
    },
  };
  const win = Object.assign(target, { localStorage });

  /** What another tab's write looks like here. */
  function otherTabWrites(key: string | null, newValue: string | null) {
    if (key === null) data.clear();
    else if (newValue === null) data.delete(key);
    else data.set(key, newValue);
    target.dispatchEvent(Object.assign(new Event('storage'), { key, newValue }));
  }

  return { win, data, fail, otherTabWrites };
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as z from 'zod/mini';
import { createLocalStore } from './local-store';
import { fakeWindow } from './test-window';

const Names = z.array(z.string().check(z.maxLength(10)));
const EMPTY: readonly string[] = Object.freeze([]);
const makeStore = () =>
  createLocalStore<readonly string[]>({
    key: 'names',
    empty: EMPTY,
    parse: (v) => {
      const r = Names.safeParse(v);
      return r.success ? r.data : EMPTY;
    },
  });

let env: ReturnType<typeof fakeWindow>;
beforeEach(() => {
  env = fakeWindow();
  vi.stubGlobal('window', env.win);
});
afterEach(() => vi.unstubAllGlobals());

describe('createLocalStore', () => {
  it('serves an empty server snapshot whatever is stored', () => {
    env.data.set('names', '["ayesha"]');
    expect(makeStore().getServerSnapshot()).toBe(EMPTY);
  });

  it('reads and validates the stored value once, then keeps the same reference', () => {
    env.data.set('names', '["ayesha","sana"]');
    const store = makeStore();
    const first = store.getSnapshot();
    expect(first).toEqual(['ayesha', 'sana']);
    expect(store.getSnapshot()).toBe(first);
  });

  it.each([
    ['malformed JSON', '{oops'],
    ['wrong shape', '{"names":1}'],
    ['values that fail validation', '["far too long a name"]'],
  ])('treats %s as empty', (_, raw) => {
    env.data.set('names', raw);
    expect(makeStore().getSnapshot()).toBe(EMPTY);
  });

  it('writes through to storage and notifies subscribers', () => {
    const store = makeStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.update((names) => [...names, 'hina']);
    expect(env.data.get('names')).toBe('["hina"]');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('skips writes and notifications when the updater returns the same value', () => {
    const store = makeStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.update((names) => names);
    expect(listener).not.toHaveBeenCalled();
    expect(env.data.has('names')).toBe(false);
  });

  it('keeps working in memory when storage is blocked', () => {
    env.fail.get = true;
    env.fail.set = true;
    const store = makeStore();
    expect(store.getSnapshot()).toBe(EMPTY);
    store.update((names) => [...names, 'hina']);
    expect(store.getSnapshot()).toEqual(['hina']);
  });

  it('keeps the in-memory value when the quota is full', () => {
    const store = makeStore();
    env.fail.set = true;
    store.update(() => ['hina']);
    expect(store.getSnapshot()).toEqual(['hina']);
  });

  it('follows writes from other tabs (validated) and ignores other keys', () => {
    const store = makeStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.getSnapshot();

    env.otherTabWrites('names', '["sana"]');
    expect(store.getSnapshot()).toEqual(['sana']);
    env.otherTabWrites('something-else', '["x"]');
    expect(listener).toHaveBeenCalledTimes(1);

    env.otherTabWrites('names', '"not a list"');
    expect(store.getSnapshot()).toBe(EMPTY);
    env.otherTabWrites('names', '["back"]');
    env.otherTabWrites(null, null); // localStorage.clear() in another tab
    expect(store.getSnapshot()).toBe(EMPTY);
  });

  it('stays in sync after every subscriber has left', () => {
    const store = makeStore();
    const unsubscribe = store.subscribe(() => {});
    store.getSnapshot();
    unsubscribe();
    env.otherTabWrites('names', '["later"]');
    expect(store.getSnapshot()).toEqual(['later']);
  });
});

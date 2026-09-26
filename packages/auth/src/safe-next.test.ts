import { describe, expect, it } from 'vitest';
import { safeNextPath } from './safe-next';

describe('safeNextPath', () => {
  it.each([
    ['/account', '/account'],
    ['/account/orders?tab=open#top', '/account/orders?tab=open#top'],
    ['/', '/'],
    ['  /cart ', '/cart'],
    ['/a/../b', '/b'],
  ])('keeps same-origin path %j', (raw, expected) => {
    expect(safeNextPath(raw, '/home')).toBe(expected);
  });

  it.each([
    ['//evil.com'],
    ['//evil.com/path'],
    ['/\\evil.com'],
    ['/\\/evil.com'],
    ['\\\\evil.com'],
    ['https://evil.com'],
    ['http:/evil.com'],
    ['javascript:alert(1)'],
    ['JavaScript:alert(1)'],
    ['evil.com'],
    ['account'],
    [''],
    ['   '],
    ['/\t/evil.com'],
    ['/\n/evil.com'],
    ['/ok\\evil'],
    [`/${'a'.repeat(2100)}`],
    // Dot segments collapse during URL resolution into a protocol-relative "//evil.com".
    ['/.//evil.com'],
    ['/..//evil.com'],
    ['/a/..//evil.com'],
    ['/x/../..//evil.com/phish'],
    ['/%2e//evil.com'],
    ['/%2e%2e//evil.com/phish'],
    ['/%2E%2E//evil.com'],
    ['/./\\evil.com'],
  ])('rejects %j', (raw) => {
    expect(safeNextPath(raw, '/home')).toBe('/home');
  });

  it('never returns a value a browser would resolve to another origin', () => {
    const samples = ['/.//a.test', '/..//a.test/x?y#z', '/b/./..//a.test', '/%2e/%2e%2e//a.test'];
    for (const raw of samples) {
      const out = safeNextPath(raw, '/home');
      expect(new URL(out, 'https://herbeauty.pk').origin).toBe('https://herbeauty.pk');
    }
  });

  it('rejects non-strings', () => {
    expect(safeNextPath(undefined, '/home')).toBe('/home');
    expect(safeNextPath(null, '/home')).toBe('/home');
    expect(safeNextPath(['/account'], '/home')).toBe('/home');
  });
});

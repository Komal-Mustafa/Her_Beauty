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
  ])('rejects %j', (raw) => {
    expect(safeNextPath(raw, '/home')).toBe('/home');
  });

  it('rejects non-strings', () => {
    expect(safeNextPath(undefined, '/home')).toBe('/home');
    expect(safeNextPath(null, '/home')).toBe('/home');
    expect(safeNextPath(['/account'], '/home')).toBe('/home');
  });
});

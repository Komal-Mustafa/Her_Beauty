import { describe, expect, it } from 'vitest';
import { uuidv7 } from './uuid';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('uuidv7', () => {
  it('produces a canonical lowercase UUID string', () => {
    for (let i = 0; i < 100; i++) {
      expect(uuidv7()).toMatch(UUID_RE);
    }
  });

  it('sets the version nibble to 7', () => {
    for (let i = 0; i < 100; i++) {
      expect(uuidv7().charAt(14)).toBe('7');
    }
  });

  it('sets the RFC 9562 variant bits (10xx)', () => {
    for (let i = 0; i < 100; i++) {
      expect(['8', '9', 'a', 'b']).toContain(uuidv7().charAt(19));
    }
  });

  it('encodes the unix ms timestamp in the first 48 bits', () => {
    const ms = 1_758_844_800_123;
    const id = uuidv7(ms);
    const tsHex = id.slice(0, 8) + id.slice(9, 13);
    expect(Number.parseInt(tsHex, 16)).toBe(ms);
  });

  it('sorts later milliseconds after earlier ones', () => {
    const base = Date.now();
    const ids = Array.from({ length: 50 }, (_, i) => uuidv7(base + i));
    expect([...ids].sort()).toEqual(ids);
  });

  it('keeps call order within the same millisecond', () => {
    const ids = Array.from({ length: 5_000 }, () => uuidv7());
    expect([...ids].sort()).toEqual(ids);
  });

  it('is unique across many calls', () => {
    const ids = new Set(Array.from({ length: 10_000 }, () => uuidv7()));
    expect(ids.size).toBe(10_000);
  });

  it('rejects out-of-range timestamps', () => {
    expect(() => uuidv7(-1)).toThrow(RangeError);
    expect(() => uuidv7(2 ** 48)).toThrow(RangeError);
    expect(() => uuidv7(1.5)).toThrow(RangeError);
  });
});

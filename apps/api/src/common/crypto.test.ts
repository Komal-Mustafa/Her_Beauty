import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  decrypt,
  encrypt,
  generateBackupCode,
  hmacSha256Hex,
  normaliseBackupCode,
  randomDigits,
  randomToken,
  safeEqual,
} from './crypto';

describe('crypto helpers', () => {
  it('HMAC-SHA256 matches the RFC 4231 test vector', () => {
    const key = Buffer.alloc(20, 0x0b);
    expect(hmacSha256Hex(key, 'Hi There')).toBe(
      'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7',
    );
  });

  it('compares strings in constant time', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });

  it('makes base64url tokens and digit codes of the requested size', () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken(16)).toMatch(/^[A-Za-z0-9_-]{22}$/);
    for (let i = 0; i < 50; i++) expect(randomDigits(6)).toMatch(/^[0-9]{6}$/);
  });

  describe('AES-256-GCM', () => {
    const key = randomBytes(32);

    it('round-trips with the documented byte layout', () => {
      const plain = Buffer.from('JBSWY3DPEHPK3PXP');
      const blob = encrypt(key, plain, 'twofa:user-1');
      expect(blob[0]).toBe(1); // key version
      expect(blob.length).toBe(1 + 12 + 16 + plain.length);
      expect(decrypt(key, blob, 'twofa:user-1').equals(plain)).toBe(true);
    });

    it('uses a fresh IV every time', () => {
      const plain = Buffer.from('same input');
      expect(encrypt(key, plain).equals(encrypt(key, plain))).toBe(false);
    });

    it('rejects tampering, a wrong key, a wrong AAD and unknown versions', () => {
      const blob = encrypt(key, Buffer.from('secret'), 'aad');
      const flipped = Buffer.from(blob);
      flipped[flipped.length - 1] = (flipped[flipped.length - 1] ?? 0) ^ 1;
      expect(() => decrypt(key, flipped, 'aad')).toThrow();
      expect(() => decrypt(randomBytes(32), blob, 'aad')).toThrow();
      expect(() => decrypt(key, blob, 'other')).toThrow();
      const v2 = Buffer.from(blob);
      v2[0] = 2;
      expect(() => decrypt(key, v2, 'aad')).toThrow(/key version/);
      expect(() => decrypt(key, Buffer.alloc(10))).toThrow(/too short/);
    });
  });

  describe('backup codes', () => {
    it('are 10 Crockford base32 characters shown as XXXXX-XXXXX', () => {
      const seen = new Set<string>();
      for (let i = 0; i < 200; i++) {
        const code = generateBackupCode();
        expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/);
        seen.add(code);
      }
      expect(seen.size).toBe(200);
    });

    it('normalise case, dashes and Crockford aliases', () => {
      expect(normaliseBackupCode('abcde-fghjk')).toBe('ABCDEFGHJK');
      expect(normaliseBackupCode(' oiL00-11111 ')).toBe('0110011111');
      expect(normaliseBackupCode('ABCDEFGHJK')).toBe('ABCDEFGHJK');
      expect(normaliseBackupCode('ABCDE-FGHJ')).toBeNull();
      expect(normaliseBackupCode('ABCDE-FGHJU')).toBeNull(); // U is not in the alphabet
    });
  });
});

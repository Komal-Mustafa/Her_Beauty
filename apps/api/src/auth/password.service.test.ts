import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../common/errors';
import { loadConfig } from '../config/config';
import { COMMON_PASSWORDS, isCommonPassword } from './common-passwords';
import { lockMinutes } from './lockout.service';
import { PasswordService } from './password.service';

const code = (e: unknown) => JSON.stringify((e as ApiError).getResponse());

describe('PasswordService', () => {
  let passwords: PasswordService;
  let hibp: PasswordService;

  beforeAll(async () => {
    Logger.overrideLogger(false);
    passwords = new PasswordService(loadConfig({ NODE_ENV: 'test' }));
    hibp = new PasswordService(loadConfig({ NODE_ENV: 'test', HIBP_ENABLED: 'true' }));
    await passwords.onModuleInit();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('hashes with Argon2id (m=19456, t=2, p=1) and verifies', async () => {
    const hash = await passwords.hash('Velvet-Rose-Compact-2026');
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(await passwords.verify(hash, 'Velvet-Rose-Compact-2026')).toBe(true);
    expect(await passwords.verify(hash, 'velvet-rose-compact-2026')).toBe(false);
    expect(await passwords.verify('not-a-hash', 'anything')).toBe(false);
    await expect(passwords.verifyDummy('anything')).resolves.toBeUndefined();
  });

  it('enforces length, the common list and personal data', async () => {
    for (const [pw, personal] of [
      ['short', []],
      ['x'.repeat(129), []],
      ['PASSWORD123', []],
      ['Pakistan786', []],
      ['ayesha@example.pk', ['ayesha@example.pk']],
    ] as const) {
      await expect(passwords.assertStrong(pw, [...personal]), pw).rejects.toSatisfy(
        (e: unknown) => e instanceof ApiError && code(e).includes('WEAK_PASSWORD'),
      );
    }
    await expect(passwords.assertStrong('Velvet-Rose-Compact-2026')).resolves.toBeUndefined();
  });

  it('checks HIBP by SHA-1 prefix only, and fails open', async () => {
    const pw = 'Correct-Horse-Battery-77';
    const sha1 = createHash('sha1').update(pw).digest('hex').toUpperCase();
    const fetch = vi.fn(async (url: string) => {
      expect(url.endsWith(`/range/${sha1.slice(0, 5)}`)).toBe(true);
      return new Response(`0000000000000000000000000000000000A:0\n${sha1.slice(5)}:42\n`);
    });
    vi.stubGlobal('fetch', fetch);
    await expect(hibp.assertStrong(pw)).rejects.toBeInstanceOf(ApiError);
    expect(fetch).toHaveBeenCalledOnce();
    // Padding rows (count 0) do not count as breached.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(`${sha1.slice(5)}:0\n`)),
    );
    await expect(hibp.assertStrong(pw)).resolves.toBeUndefined();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    await expect(hibp.assertStrong(pw)).resolves.toBeUndefined();
    // Disabled: no network call at all.
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    await passwords.assertStrong(pw);
    expect(spy).not.toHaveBeenCalled();
  });

  it('ships about 1,000 common passwords, all at least 8 characters', () => {
    expect(COMMON_PASSWORDS.size).toBeGreaterThanOrEqual(950);
    for (const p of COMMON_PASSWORDS) expect(p.length).toBeGreaterThanOrEqual(8);
    expect(isCommonPassword('Password1')).toBe(true);
    expect(isCommonPassword('Velvet-Rose-Compact-2026')).toBe(false);
  });
});

describe('lockout back-off', () => {
  it('locks from the 5th failure for min(2^(n-5), 60) minutes', () => {
    expect([1, 4, 5, 6, 7, 10, 11, 40].map(lockMinutes)).toEqual([0, 0, 1, 2, 4, 32, 60, 60]);
  });
});

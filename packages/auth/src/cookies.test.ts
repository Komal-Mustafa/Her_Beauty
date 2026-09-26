import { afterEach, describe, expect, it, vi } from 'vitest';
import { cookieNames, cookieOptions, secondsUntil, writeTokenCookies } from './cookies';
import { accessTokenLooksLive, jwtExpiry } from './jwt';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('cookie names and options', () => {
  it('uses plain names and no Secure flag outside production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(cookieNames()).toEqual({
      access: 'hb_at',
      refresh: 'hb_rt',
      mfa: 'hb_mfa',
      pending: 'hb_pending',
    });
    expect(cookieOptions('lax', 60)).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 60,
    });
  });

  it('adds the __Host- prefix and Secure in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(cookieNames()).toEqual({
      access: '__Host-hb_at',
      refresh: '__Host-hb_rt',
      mfa: '__Host-hb_mfa',
      pending: '__Host-hb_pending',
    });
    expect(cookieOptions('strict', 30)).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
    });
  });

  it.each([
    ['web', 'lax'],
    ['seller', 'lax'],
    ['admin', 'strict'],
  ] as const)('%s cookies use SameSite=%s from the app config', (_audience, sameSite) => {
    const set = vi.fn();
    const now = Date.parse('2026-09-26T10:00:00Z');
    writeTokenCookies(
      { set },
      cookieNames(false),
      {
        accessToken: 'at',
        accessExpiresAt: '2026-09-26T10:15:00Z',
        refreshToken: 'rt',
        refreshExpiresAt: '2026-10-26T10:00:00Z',
      },
      sameSite,
      now,
    );
    expect(set).toHaveBeenCalledWith(
      'hb_at',
      'at',
      expect.objectContaining({ sameSite, maxAge: 900 }),
    );
    expect(set).toHaveBeenCalledWith(
      'hb_rt',
      'rt',
      expect.objectContaining({ sameSite, httpOnly: true, maxAge: 30 * 24 * 3600 }),
    );
  });

  it('never produces a negative max-age', () => {
    expect(secondsUntil('2020-01-01T00:00:00Z', Date.now())).toBe(0);
    expect(secondsUntil('not a date', Date.now())).toBe(0);
    expect(cookieOptions('lax', -5).maxAge).toBe(0);
  });
});

function jwt(payload: object): string {
  const b64 = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');
  return `${b64({ alg: 'EdDSA' })}.${b64(payload)}.c2ln`;
}

describe('access token expiry (unverified read)', () => {
  const now = Date.parse('2026-09-26T10:00:00Z');
  const sec = now / 1000;

  it('reads exp', () => {
    expect(jwtExpiry(jwt({ exp: sec + 600 }))).toBe(sec + 600);
    expect(jwtExpiry('garbage')).toBeNull();
    expect(jwtExpiry('a.!!!.c')).toBeNull();
    expect(jwtExpiry(jwt({ sub: 'x' }))).toBeNull();
  });

  it('treats tokens close to expiry as not live', () => {
    expect(accessTokenLooksLive(jwt({ exp: sec + 600 }), now)).toBe(true);
    expect(accessTokenLooksLive(jwt({ exp: sec + 10 }), now)).toBe(false);
    expect(accessTokenLooksLive(jwt({ exp: sec - 1 }), now)).toBe(false);
    expect(accessTokenLooksLive(undefined, now)).toBe(false);
  });
});

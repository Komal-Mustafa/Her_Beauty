import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cookieNames,
  cookieOptions,
  sameSiteFor,
  secondsUntil,
  writeTokenCookies,
} from './cookies';
import { createAuthCore } from './core';
import { accessTokenLooksLive, jwtExpiry } from './jwt';
import { createAuthMiddleware } from './middleware';
import { resetRefreshCache } from './refresh';
import { FakeJar, fakeApi, ME, TEST_NOW, tokens } from './test-support';

beforeEach(() => {
  vi.stubEnv('API_INTERNAL_URL', 'http://api.test/v1');
  vi.stubEnv('NODE_ENV', 'test');
  resetRefreshCache();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('cookie names and options', () => {
  it('names carry the audience and have no Secure flag outside production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(cookieNames('web')).toEqual({
      access: 'hb_web_at',
      refresh: 'hb_web_rt',
      mfa: 'hb_web_mfa',
      pending: 'hb_web_pending',
    });
    expect(cookieOptions('lax', 60)).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 60,
    });
  });

  it('never shares a name between the three apps (localhost ports share one cookie jar)', () => {
    const all = (['web', 'seller', 'admin'] as const).flatMap((audience) =>
      Object.values(cookieNames(audience, false)),
    );
    expect(new Set(all).size).toBe(all.length);
    expect(cookieNames('seller', false).refresh).toBe('hb_seller_rt');
    expect(cookieNames('admin', false).access).toBe('hb_admin_at');
  });

  it('adds the __Host- prefix and Secure in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(cookieNames('admin')).toEqual({
      access: '__Host-hb_admin_at',
      refresh: '__Host-hb_admin_rt',
      mfa: '__Host-hb_admin_mfa',
      pending: '__Host-hb_admin_pending',
    });
    expect(cookieOptions('strict', 30)).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
    });
  });

  it('writes both token cookies with max-age from the expiry', () => {
    const set = vi.fn();
    const now = Date.parse('2026-09-26T10:00:00Z');
    writeTokenCookies(
      { set },
      cookieNames('web', false),
      {
        accessToken: 'at',
        accessExpiresAt: '2026-09-26T10:15:00Z',
        refreshToken: 'rt',
        refreshExpiresAt: '2026-10-26T10:00:00Z',
      },
      'lax',
      now,
    );
    expect(set).toHaveBeenCalledWith(
      'hb_web_at',
      'at',
      expect.objectContaining({ sameSite: 'lax', maxAge: 900 }),
    );
    expect(set).toHaveBeenCalledWith(
      'hb_web_rt',
      'rt',
      expect.objectContaining({ sameSite: 'lax', httpOnly: true, maxAge: 30 * 24 * 3600 }),
    );
  });

  it('never produces a negative max-age', () => {
    expect(secondsUntil('2020-01-01T00:00:00Z', Date.now())).toBe(0);
    expect(secondsUntil('not a date', Date.now())).toBe(0);
    expect(cookieOptions('lax', -5).maxAge).toBe(0);
  });
});

// security.md §4 and b2-auth §7: admin cookies are SameSite=Strict, shop and seller Lax. The apps
// pass only their audience, so no app config can weaken it.
describe('SameSite comes from the audience', () => {
  const cases = [
    ['web', 'lax'],
    ['seller', 'lax'],
    ['admin', 'strict'],
  ] as const;

  it.each(cases)('%s → %s', (audience, sameSite) => {
    expect(sameSiteFor(audience)).toBe(sameSite);
  });

  it.each(cases)(
    '%s login cookies (createAuthCore) use SameSite=%s',
    async (audience, sameSite) => {
      const api = fakeApi({
        'POST /auth/login': [{ status: 200, body: { status: 'ok', tokens: tokens(1), user: ME } }],
      });
      const jar = new FakeJar();
      const auth = createAuthCore(
        { audience },
        {
          cookies: async () => jar,
          headers: async () => new Headers(),
          redirect: (url: string): never => {
            throw new Error(url);
          },
          fetch: api.fetch,
          now: () => TEST_NOW,
        },
      );
      await auth.login({ identifier: 'a@b.pk', password: 'x' });
      const names = cookieNames(audience);
      for (const name of [names.access, names.refresh]) {
        expect(jar.writes.find((w) => w.name === name)?.options.sameSite).toBe(sameSite);
      }
      expect(auth.config.sameSite).toBe(sameSite);
    },
  );

  it.each(cases)('%s refresh cookies (middleware) use SameSite=%s', async (audience, sameSite) => {
    const api = fakeApi({ 'POST /auth/refresh': [{ status: 200, body: tokens(1) }] });
    const middleware = createAuthMiddleware({
      audience,
      protectedPrefixes: ['/'],
      fetch: api.fetch,
      now: () => TEST_NOW,
    });
    const names = cookieNames(audience);
    const res = await middleware(
      new NextRequest('http://localhost:3002/', { headers: { cookie: `${names.refresh}=rt-0` } }),
    );
    expect(res.cookies.get(names.access)?.sameSite).toBe(sameSite);
    expect(res.cookies.get(names.refresh)?.sameSite).toBe(sameSite);
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

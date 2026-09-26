import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthMiddleware, isProtectedPath } from './middleware';
import { resetRefreshCache } from './refresh';
import { apiError, fakeApi, TEST_NOW, tokens } from './test-support';

const NOW = TEST_NOW;

function jwt(expSec: number): string {
  const b64 = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');
  return `${b64({ alg: 'EdDSA' })}.${b64({ exp: expSec, sub: 'u1' })}.c2ln`;
}

function request(
  path: string,
  cookies: Record<string, string> = {},
  headers: Record<string, string> = {},
) {
  const cookie = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: {
      ...(cookie ? { cookie } : {}),
      // The browser wrote the first entry; the proxy in front of Next.js appended the second.
      'x-forwarded-for': '198.51.100.66, 203.0.113.7',
      ...headers,
    },
  });
}

function setup(routes: Parameters<typeof fakeApi>[0] = {}) {
  const api = fakeApi(routes);
  const middleware = createAuthMiddleware({
    audience: 'web',
    protectedPrefixes: ['/account'],
    loginPath: '/login',
    fetch: api.fetch,
    now: () => NOW,
  });
  return { api, middleware };
}

const isPassThrough = (res: Response) => res.headers.get('x-middleware-next') === '1';

beforeEach(() => {
  vi.stubEnv('API_INTERNAL_URL', 'http://api.test/v1');
  vi.stubEnv('NODE_ENV', 'test');
  resetRefreshCache();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isProtectedPath', () => {
  it('matches the prefix and its children only', () => {
    expect(isProtectedPath('/account', ['/account'])).toBe(true);
    expect(isProtectedPath('/account/orders', ['/account/'])).toBe(true);
    expect(isProtectedPath('/accounting', ['/account'])).toBe(false);
    expect(isProtectedPath('/', ['/account'])).toBe(false);
    expect(isProtectedPath('/anything', ['/'])).toBe(true);
  });
});

describe('createAuthMiddleware', () => {
  it('lets public paths through untouched', async () => {
    const { middleware, api } = setup();
    const res = await middleware(request('/'));
    expect(isPassThrough(res)).toBe(true);
    expect(api.fetch).not.toHaveBeenCalled();
  });

  it('lets a live-looking access cookie through without calling the API', async () => {
    const { middleware, api } = setup();
    const res = await middleware(request('/account', { hb_web_at: jwt(NOW / 1000 + 600) }));
    expect(isPassThrough(res)).toBe(true);
    expect(api.fetch).not.toHaveBeenCalled();
  });

  it('redirects to login with next when there is no refresh cookie', async () => {
    const { middleware } = setup();
    const res = await middleware(request('/account/orders?page=2'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/login?next=%2Faccount%2Forders%3Fpage%3D2',
    );
  });

  it('refreshes an expired access cookie, sets the new cookies and forwards them to the page', async () => {
    const { middleware, api } = setup({ 'POST /auth/refresh': [{ status: 200, body: tokens(1) }] });
    const res = await middleware(
      request('/account', { hb_web_at: jwt(NOW / 1000 - 5), hb_web_rt: 'rt-0', theme: 'x' }),
    );
    expect(isPassThrough(res)).toBe(true);
    expect(api.calls[0]).toMatchObject({
      method: 'POST',
      path: '/auth/refresh',
      body: { refreshToken: 'rt-0' },
      headers: { 'x-forwarded-for': '203.0.113.7' },
    });
    expect(res.cookies.get('hb_web_at')).toMatchObject({
      value: 'at-1',
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
    expect(res.cookies.get('hb_web_at')?.maxAge).toBe(900);
    expect(res.cookies.get('hb_web_rt')?.value).toBe('rt-1');
    // The page render sees the new cookies (Next passes these as overridden request headers).
    expect(res.headers.get('x-middleware-request-cookie')).toContain('hb_web_at=at-1');
    expect(res.headers.get('x-middleware-request-cookie')).toContain('theme=x');
  });

  it('refreshes when the access cookie is missing but a refresh cookie exists', async () => {
    const { middleware, api } = setup({ 'POST /auth/refresh': [{ status: 200, body: tokens(1) }] });
    await middleware(request('/account', { hb_web_rt: 'rt-0' }));
    expect(api.count('POST /auth/refresh')).toBe(1);
  });

  it('redirects and clears cookies when the refresh token is rejected', async () => {
    const { middleware } = setup({ 'POST /auth/refresh': [apiError(401, 'SESSION_REVOKED')] });
    const res = await middleware(request('/account', { hb_web_at: 'garbage', hb_web_rt: 'rt-0' }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login?next=%2Faccount');
    expect(res.cookies.get('hb_web_rt')).toMatchObject({ value: '', maxAge: 0 });
    expect(res.cookies.get('hb_web_at')).toMatchObject({ value: '', maxAge: 0 });
  });

  it('never refreshes for router prefetches', async () => {
    const { middleware, api } = setup();
    const res = await middleware(
      request('/account', { hb_web_rt: 'rt-0' }, { 'next-router-prefetch': '1' }),
    );
    expect(isPassThrough(res)).toBe(true);
    expect(api.fetch).not.toHaveBeenCalled();
  });

  it('never refreshes inside the server-side fetch Next makes for an action redirect', async () => {
    const { middleware, api } = setup();
    const internal = await middleware(request('/account', { hb_web_rt: 'rt-0' }, { rsc: '1' }));
    expect(isPassThrough(internal)).toBe(true);
    expect(api.fetch).not.toHaveBeenCalled();
  });

  it('still refreshes client-side RSC navigations (they carry the router state tree)', async () => {
    const { middleware, api } = setup({ 'POST /auth/refresh': [{ status: 200, body: tokens(1) }] });
    await middleware(
      request('/account', { hb_web_rt: 'rt-0' }, { rsc: '1', 'next-router-state-tree': '%5B%5D' }),
    );
    expect(api.count('POST /auth/refresh')).toBe(1);
  });

  it('forwards the proxy-seen IP, never a spoofed first X-Forwarded-For entry', async () => {
    const { middleware, api } = setup({ 'POST /auth/refresh': [{ status: 200, body: tokens(1) }] });
    await middleware(request('/account', { hb_web_rt: 'rt-0' }));
    expect(api.calls[0]?.headers['x-forwarded-for']).toBe('203.0.113.7');
  });

  it('lets the page decide when the API is unreachable', async () => {
    const { middleware } = setup({ 'POST /auth/refresh': ['network'] });
    const res = await middleware(request('/account', { hb_web_rt: 'rt-0' }));
    expect(isPassThrough(res)).toBe(true);
  });

  it('uses the __Host- cookie names in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { middleware } = setup({ 'POST /auth/refresh': [{ status: 200, body: tokens(1) }] });
    const res = await middleware(request('/account', { '__Host-hb_web_rt': 'rt-0' }));
    expect(res.cookies.get('__Host-hb_web_at')).toMatchObject({ value: 'at-1', secure: true });
  });
});

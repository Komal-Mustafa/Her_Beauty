import { Me } from '@hb/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthCore, type AuthDeps } from './core';
import { ApiRequestError } from './errors';
import { resetRefreshCache } from './refresh';
import { apiError, FakeJar, fakeApi, ME, TEST_NOW, tokens } from './test-support';

// What Next.js hands the app behind one appending proxy: the browser wrote the first entry, the
// proxy appended the address it saw.
const BROWSER_HEADERS = new Headers({
  'x-forwarded-for': '198.51.100.66, 203.0.113.7',
  'user-agent': 'Mozilla/5.0 Test',
});

class Redirected extends Error {
  constructor(readonly url: string) {
    super(`redirect ${url}`);
  }
}

function setup(
  routes: Parameters<typeof fakeApi>[0],
  cookies: Record<string, string> = {},
  extra: Partial<AuthDeps> = {},
) {
  const api = fakeApi(routes);
  const jar = new FakeJar(cookies);
  let clock = TEST_NOW;
  const auth = createAuthCore(
    { audience: 'web', loginPath: '/login', homePath: '/account' },
    {
      cookies: async () => jar,
      headers: async () => BROWSER_HEADERS,
      redirect: (url: string): never => {
        throw new Redirected(url);
      },
      fetch: api.fetch,
      now: () => clock,
      ...extra,
    },
  );
  return {
    auth,
    api,
    jar,
    tick: (ms: number) => {
      clock += ms;
    },
  };
}

beforeEach(() => {
  vi.stubEnv('API_INTERNAL_URL', 'http://api.test/v1');
  vi.stubEnv('NODE_ENV', 'test');
  resetRefreshCache();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getSession', () => {
  it('returns null without cookies and never calls the API', async () => {
    const { auth, api } = setup({});
    await expect(auth.getSession()).resolves.toBeNull();
    expect(api.fetch).not.toHaveBeenCalled();
  });

  it('calls GET /me with the bearer token and forwards the browser IP and user agent', async () => {
    const { auth, api } = setup({ 'GET /me': [{ status: 200, body: ME }] }, { hb_web_at: 'at-0' });
    await expect(auth.getSession()).resolves.toEqual(ME);
    expect(api.calls[0]?.headers).toMatchObject({
      authorization: 'Bearer at-0',
      'x-forwarded-for': '203.0.113.7',
      'user-agent': 'Mozilla/5.0 Test',
    });
  });

  it('never forwards the client-written (left-most) X-Forwarded-For entry', async () => {
    const { auth, api } = setup(
      { 'GET /me': [{ status: 200, body: ME }] },
      { hb_web_at: 'at-0' },
      {
        headers: async () =>
          new Headers({
            'x-forwarded-for': '1.2.3.4, 5.6.7.8, 203.0.113.7',
            'x-real-ip': '9.9.9.9',
          }),
      },
    );
    await auth.getSession();
    expect(api.calls[0]?.headers['x-forwarded-for']).toBe('203.0.113.7');
  });

  it('refreshes once on 401, stores the rotated cookies and retries', async () => {
    const { auth, api, jar } = setup(
      {
        'GET /me': [apiError(401, 'UNAUTHENTICATED'), { status: 200, body: ME }],
        'POST /auth/refresh': [{ status: 200, body: tokens(1) }],
      },
      { hb_web_at: 'at-0', hb_web_rt: 'rt-0' },
    );
    await expect(auth.getSession()).resolves.toEqual(ME);
    expect(api.calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'GET /me',
      'POST /auth/refresh',
      'GET /me',
    ]);
    expect(api.calls[1]?.body).toEqual({ refreshToken: 'rt-0' });
    expect(api.calls[2]?.headers.authorization).toBe('Bearer at-1');
    expect(jar.values.get('hb_web_at')).toBe('at-1');
    expect(jar.values.get('hb_web_rt')).toBe('rt-1');
    const rt = jar.writes.find((w) => w.name === 'hb_web_rt');
    expect(rt?.options).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: false,
    });
  });

  it('does not refresh where cookies are read-only (server components)', async () => {
    const { auth, api, jar } = setup(
      { 'GET /me': [apiError(401, 'UNAUTHENTICATED')] },
      { hb_web_at: 'at-0', hb_web_rt: 'rt-0' },
    );
    jar.readonly = true;
    await expect(auth.getSession()).resolves.toBeNull();
    expect(api.count('POST /auth/refresh')).toBe(0);
    expect(jar.values.get('hb_web_rt')).toBe('rt-0');
  });

  it('returns null and clears cookies when the refresh token is rejected', async () => {
    const { auth, jar } = setup(
      {
        'GET /me': [apiError(401, 'UNAUTHENTICATED')],
        'POST /auth/refresh': [apiError(401, 'SESSION_REVOKED')],
      },
      { hb_web_at: 'at-0', hb_web_rt: 'rt-0' },
    );
    await expect(auth.getSession()).resolves.toBeNull();
    expect(jar.values.has('hb_web_at')).toBe(false);
    expect(jar.values.has('hb_web_rt')).toBe(false);
  });

  it('throws (instead of pretending to be logged out) when the API is unreachable', async () => {
    const { auth } = setup({ 'GET /me': ['network'] }, { hb_web_at: 'at-0' });
    await expect(auth.getSession()).rejects.toMatchObject({ code: 'NETWORK', status: 0 });
  });
});

describe('apiFetch', () => {
  it('refreshes first when only the refresh cookie is left', async () => {
    const { auth, api } = setup(
      {
        'POST /auth/refresh': [{ status: 200, body: tokens(1) }],
        'GET /me': [{ status: 200, body: ME }],
      },
      { hb_web_rt: 'rt-0' },
    );
    await expect(auth.apiFetch('/me', Me)).resolves.toEqual(ME);
    expect(api.calls[1]?.headers.authorization).toBe('Bearer at-1');
  });

  it('shares one refresh between parallel calls (rotation + reuse detection)', async () => {
    const { auth, api } = setup(
      {
        'POST /auth/refresh': [{ status: 200, body: tokens(1) }],
        'GET /me': [
          { status: 200, body: ME },
          { status: 200, body: ME },
        ],
      },
      { hb_web_rt: 'rt-0' },
    );
    await Promise.all([auth.apiFetch('/me', Me), auth.apiFetch('/me', Me)]);
    expect(api.count('POST /auth/refresh')).toBe(1);
  });

  it('throws a typed ApiRequestError carrying the API error code', async () => {
    const { auth } = setup(
      { 'GET /admin/overview': [apiError(403, 'MFA_REQUIRED')] },
      { hb_web_at: 'at-0' },
    );
    const error = await auth.apiFetch('/admin/overview', Me).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 403, code: 'MFA_REQUIRED' });
  });

  it('rejects responses that do not match the schema', async () => {
    const { auth } = setup(
      { 'GET /me': [{ status: 200, body: { id: 1 } }] },
      { hb_web_at: 'at-0' },
    );
    await expect(auth.apiFetch('/me', Me)).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
  });

  it('throws UNAUTHENTICATED without calling the API when there is no session', async () => {
    const { auth, api } = setup({});
    await expect(auth.apiFetch('/me', Me)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(api.fetch).not.toHaveBeenCalled();
  });
});

describe('requireSession', () => {
  it('redirects logged-out visitors to the login page with a safe next', async () => {
    const { auth } = setup({});
    await expect(auth.requireSession('/account?tab=security')).rejects.toMatchObject({
      url: '/login?next=%2Faccount%3Ftab%3Dsecurity',
    });
    await expect(auth.requireSession('//evil.com')).rejects.toMatchObject({
      url: '/login?next=%2Faccount',
    });
  });

  it('returns the user when signed in', async () => {
    const { auth } = setup({ 'GET /me': [{ status: 200, body: ME }] }, { hb_web_at: 'at-0' });
    await expect(auth.requireSession()).resolves.toEqual(ME);
  });
});

describe('login', () => {
  it('sets the token cookies and returns a safe next path', async () => {
    const { auth, api, jar } = setup({
      'POST /auth/login': [{ status: 200, body: { status: 'ok', tokens: tokens(1), user: ME } }],
    });
    const form = new FormData();
    form.set('identifier', 'ayesha@hb.test');
    form.set('password', 'correct horse');
    form.set('next', '/account/orders');
    const result = await auth.login(form);
    expect(result).toEqual({ status: 'ok', user: ME, next: '/account/orders' });
    expect(api.calls[0]?.body).toEqual({
      audience: 'web',
      identifier: 'ayesha@hb.test',
      password: 'correct horse',
    });
    expect(jar.values.get('hb_web_at')).toBe('at-1');
    expect(jar.values.get('hb_web_rt')).toBe('rt-1');
  });

  it('ignores an unsafe next', async () => {
    const { auth } = setup({
      'POST /auth/login': [{ status: 200, body: { status: 'ok', tokens: tokens(1), user: ME } }],
    });
    const result = await auth.login({ identifier: 'a@b.pk', password: 'x', next: '//evil.com' });
    expect(result).toMatchObject({ status: 'ok', next: '/account' });
  });

  it('revokes the session this browser had before', async () => {
    const { auth, api } = setup(
      {
        'POST /auth/login': [{ status: 200, body: { status: 'ok', tokens: tokens(1), user: ME } }],
        'POST /auth/logout': [{ status: 204 }],
      },
      { hb_web_rt: 'rt-old' },
    );
    await auth.login({ identifier: 'a@b.pk', password: 'x' });
    expect(api.calls.find((c) => c.path === '/auth/logout')?.body).toEqual({
      refreshToken: 'rt-old',
    });
  });

  it('keeps the 2FA challenge token in hb_web_mfa (never in the result) and finishes with the code', async () => {
    const { auth, api, jar } = setup({
      'POST /auth/login': [
        {
          status: 200,
          body: { status: 'mfa_required', challengeToken: 'ch-1', expiresInSec: 300 },
        },
      ],
      'POST /auth/2fa/challenge': [
        { status: 200, body: { status: 'ok', tokens: tokens(2), user: ME } },
      ],
    });
    const first = await auth.login({ identifier: 'a@b.pk', password: 'x', next: '/account' });
    expect(first).toEqual({ status: 'mfa_required', next: '/account' });
    expect(JSON.stringify(first)).not.toContain('ch-1');
    expect(jar.values.has('hb_web_mfa')).toBe(true);
    expect(jar.values.has('hb_web_at')).toBe(false);
    expect(jar.writes.find((w) => w.name === 'hb_web_mfa')?.options.maxAge).toBe(300);
    await expect(auth.getMfaChallenge()).resolves.toEqual({ kind: 'mfa', next: '/account' });

    const second = await auth.challenge2fa({ code: '123456' });
    expect(second).toEqual({ status: 'ok', user: ME, next: '/account' });
    expect(api.calls[1]?.body).toEqual({ challengeToken: 'ch-1', code: '123456' });
    expect(jar.values.has('hb_web_mfa')).toBe(false);
    expect(jar.values.get('hb_web_at')).toBe('at-2');
  });

  it('validates before calling the API and never echoes the password', async () => {
    const { auth, api } = setup({});
    const result = await auth.login({ identifier: 'ayesha@hb.test', password: '' });
    expect(result).toMatchObject({
      status: 'error',
      code: 'VALIDATION_FAILED',
      fieldErrors: { password: 'Enter your password.' },
      values: { identifier: 'ayesha@hb.test' },
    });
    if (result.status === 'error') expect(result.values).not.toHaveProperty('password');
    expect(api.fetch).not.toHaveBeenCalled();
  });

  it('maps INVALID_CREDENTIALS + captchaRequired to a friendly error', async () => {
    const { auth } = setup({
      'POST /auth/login': [apiError(401, 'INVALID_CREDENTIALS', { captchaRequired: true })],
    });
    const result = await auth.login({ identifier: 'a@b.pk', password: 'wrong-one' });
    expect(result).toMatchObject({
      status: 'error',
      code: 'INVALID_CREDENTIALS',
      captchaRequired: true,
      values: { identifier: 'a@b.pk' },
    });
    if (result.status === 'error') expect(result.message).toMatch(/security check/);
  });

  it('reports NETWORK when the API is down', async () => {
    const { auth } = setup({ 'POST /auth/login': ['network'] });
    await expect(auth.login({ identifier: 'a@b.pk', password: 'x' })).resolves.toMatchObject({
      status: 'error',
      code: 'NETWORK',
    });
  });
});

describe('result shapes are shared across helpers', () => {
  const limited = apiError(429, 'RATE_LIMITED', { retryAfterSec: 120 });

  it.each([
    ['sendOtp', 'POST /auth/otp/send', { target: '0300 1234567' }],
    ['forgotPassword', 'POST /auth/password/forgot', { identifier: 'ayesha@hb.test' }],
    ['login', 'POST /auth/login', { identifier: 'ayesha@hb.test', password: 'x' }],
    [
      'register',
      'POST /auth/register',
      { fullName: 'Ayesha', email: 'ayesha@hb.test', password: 'long enough' },
    ],
  ] as const)('%s maps RATE_LIMITED the same way', async (helper, route, input) => {
    const { auth } = setup({ [route]: [limited] });
    const result = await auth[helper](input);
    expect(result).toMatchObject({
      status: 'error',
      code: 'RATE_LIMITED',
      retryAfterSec: 120,
      message: 'Too many tries for now. Please wait 2 minutes, then try again.',
    });
  });

  it.each([
    ['verifyOtp', 'POST /auth/otp/verify'],
    ['resetPassword', 'POST /auth/password/reset'],
  ] as const)('%s shows INVALID_CODE on the code field', async (helper, route) => {
    const { auth } = setup({
      'POST /auth/otp/send': [{ status: 202, body: { status: 'sent', expiresInSec: 300 } }],
      'POST /auth/password/forgot': [{ status: 202 }],
      [route]: [apiError(400, 'INVALID_CODE')],
    });
    if (helper === 'verifyOtp') await auth.sendOtp({ target: '03001234567' });
    else await auth.forgotPassword({ identifier: 'ayesha@hb.test' });
    const result = await auth[helper]({ code: '000000', newPassword: 'a-new-password' });
    expect(result).toMatchObject({ status: 'error', code: 'INVALID_CODE' });
    if (result.status === 'error') expect(result.fieldErrors?.code).toBe(result.message);
  });
});

describe('register and verify', () => {
  it('remembers the real target for /verify while showing the masked one', async () => {
    const { auth, api } = setup({
      'POST /auth/register': [
        {
          status: 202,
          body: { status: 'verification_sent', channel: 'email', target: 'a•••@hb.test' },
        },
      ],
      'POST /auth/otp/verify': [
        { status: 200, body: { status: 'ok', tokens: tokens(1), user: ME } },
      ],
    });
    const result = await auth.register({
      fullName: 'Ayesha Khan',
      email: 'Ayesha@HB.test',
      password: 'a long password',
      next: '/cart',
    });
    expect(result).toEqual({
      status: 'verification_sent',
      channel: 'email',
      target: 'a•••@hb.test',
    });
    await expect(auth.getPending()).resolves.toMatchObject({
      channel: 'email',
      target: 'a•••@hb.test',
      purpose: 'verify',
      resendInSec: 60,
      next: '/cart',
    });
    const verified = await auth.verifyOtp({ code: '123456' });
    expect(verified).toEqual({ status: 'ok', user: ME, next: '/cart' });
    expect(api.calls[1]?.body).toEqual({
      audience: 'web',
      channel: 'email',
      target: 'ayesha@hb.test',
      purpose: 'verify',
      code: '123456',
    });
    await expect(auth.getPending()).resolves.toBeNull();
  });

  it('asks for an email or a mobile number', async () => {
    const { auth } = setup({});
    const result = await auth.register({ fullName: 'Ayesha', password: 'a long password' });
    expect(result).toMatchObject({ status: 'error', code: 'VALIDATION_FAILED' });
  });

  it('WEAK_PASSWORD lands on the password field', async () => {
    const { auth } = setup({ 'POST /auth/register': [apiError(400, 'WEAK_PASSWORD')] });
    const result = await auth.register({
      fullName: 'Ayesha',
      phone: '0300 1234567',
      password: 'password1',
    });
    expect(result).toMatchObject({ status: 'error', code: 'WEAK_PASSWORD' });
    if (result.status === 'error') expect(result.fieldErrors?.password).toBeDefined();
  });

  it('PROFILE_REQUIRED keeps the code server-side and finishes with just the name', async () => {
    const { auth, api } = setup({
      'POST /auth/otp/send': [{ status: 202, body: { status: 'sent', expiresInSec: 300 } }],
      'POST /auth/otp/verify': [
        apiError(422, 'PROFILE_REQUIRED'),
        { status: 200, body: { status: 'ok', tokens: tokens(1), user: ME } },
      ],
    });
    const sent = await auth.sendOtp({ target: '0300 1234567' });
    expect(sent).toEqual({ status: 'sent', channel: 'sms', target: '•••• 567', expiresInSec: 300 });
    await expect(auth.verifyOtp({ code: '654321' })).resolves.toEqual({
      status: 'profile_required',
    });
    await expect(auth.getPending()).resolves.toMatchObject({ needsName: true });
    const done = await auth.verifyOtp({ fullName: 'Sana Ali' });
    expect(done).toMatchObject({ status: 'ok' });
    expect(api.calls[2]?.body).toMatchObject({
      code: '654321',
      fullName: 'Sana Ali',
      purpose: 'login',
    });
  });

  it('enforces the resend cooldown, then resends', async () => {
    const { auth, api, tick } = setup({
      'POST /auth/otp/send': [
        { status: 202, body: { status: 'sent', expiresInSec: 300 } },
        { status: 202, body: { status: 'sent', expiresInSec: 300 } },
      ],
    });
    await auth.sendOtp({ target: '03001234567' });
    tick(20_000);
    await expect(auth.resendCode()).resolves.toMatchObject({
      status: 'error',
      code: 'RESEND_TOO_SOON',
      retryAfterSec: 40,
    });
    tick(41_000);
    await expect(auth.resendCode()).resolves.toMatchObject({ status: 'sent' });
    expect(api.count('POST /auth/otp/send')).toBe(2);
  });

  it('says the request timed out when nothing is pending', async () => {
    const { auth } = setup({});
    await expect(auth.verifyOtp({ code: '123456' })).resolves.toMatchObject({
      code: 'PENDING_EXPIRED',
    });
    await expect(auth.resendCode()).resolves.toMatchObject({ code: 'PENDING_EXPIRED' });
  });
});

describe('two-factor', () => {
  it('asks to log in again when the challenge is missing or expired', async () => {
    const { auth } = setup({});
    await expect(auth.challenge2fa({ code: '123456' })).resolves.toMatchObject({
      code: 'MFA_EXPIRED',
    });
  });

  it('drops hb_web_mfa when the API rejects the challenge token', async () => {
    const { auth, jar } = setup({
      'POST /auth/login': [
        {
          status: 200,
          body: { status: 'mfa_required', challengeToken: 'ch-1', expiresInSec: 300 },
        },
      ],
      'POST /auth/2fa/challenge': [apiError(401, 'UNAUTHENTICATED')],
    });
    await auth.login({ identifier: 'a@b.pk', password: 'x' });
    await expect(auth.challenge2fa({ code: '123456' })).resolves.toMatchObject({
      code: 'MFA_EXPIRED',
    });
    expect(jar.values.has('hb_web_mfa')).toBe(false);
  });

  it('sets up with a QR code and enables with backup codes', async () => {
    const codes = Array.from({ length: 10 }, (_, i) => `AAAA${i}-BBBBB`);
    const { auth, api } = setup(
      {
        'POST /auth/2fa/setup': [
          {
            status: 200,
            body: {
              secret: 'JBSWY3DPEHPK3PXPJBSWY3DP',
              otpauthUri:
                'otpauth://totp/Her%20Beauty:ayesha?secret=JBSWY3DPEHPK3PXP&issuer=Her%20Beauty',
            },
          },
        ],
        'POST /auth/2fa/enable': [{ status: 200, body: { backupCodes: codes } }],
      },
      { hb_web_at: 'at-0' },
    );
    const setupResult = await auth.setup2fa();
    expect(setupResult).toMatchObject({ status: 'ok', secret: 'JBSWY3DPEHPK3PXPJBSWY3DP' });
    if (setupResult.status === 'ok') {
      expect(setupResult.qrDataUrl.startsWith('data:image/svg+xml;base64,')).toBe(true);
    }
    await expect(auth.enable2fa({ code: '123 456' })).resolves.toEqual({
      status: 'ok',
      backupCodes: codes,
    });
    expect(api.calls[1]?.body).toEqual({ code: '123456' });
    expect(api.calls[1]?.headers.authorization).toBe('Bearer at-0');
  });

  it('admin first sign-in: enrols with the setup challenge and finishes the login', async () => {
    const codes = Array.from({ length: 10 }, (_, i) => `CCCC${i}-DDDDD`);
    const { auth, api, jar } = setup({
      'POST /auth/login': [
        {
          status: 200,
          body: { status: 'mfa_setup_required', challengeToken: 'setup-1', expiresInSec: 300 },
        },
      ],
      'POST /auth/2fa/enable': [
        {
          status: 200,
          body: {
            backupCodes: codes,
            login: { status: 'ok', tokens: tokens(3), user: ME },
          },
        },
      ],
    });
    await expect(auth.login({ identifier: 'root@hb.test', password: 'x' })).resolves.toMatchObject({
      status: 'mfa_setup_required',
    });
    const enabled = await auth.enable2fa({ code: '123456' });
    expect(enabled).toMatchObject({ status: 'ok', backupCodes: codes, user: ME, next: '/account' });
    expect(api.calls[1]?.body).toEqual({ challengeToken: 'setup-1', code: '123456' });
    expect(api.calls[1]?.headers.authorization).toBeUndefined();
    expect(jar.values.get('hb_web_at')).toBe('at-3');
    expect(jar.values.has('hb_web_mfa')).toBe(false);
  });
});

describe('sessions and logout', () => {
  it('logout always clears the cookies, even when the API is unreachable', async () => {
    const { auth, jar } = setup(
      { 'POST /auth/logout': ['network'] },
      { hb_web_at: 'at-0', hb_web_rt: 'rt-0', hb_web_pending: 'x' },
    );
    await expect(auth.logout()).resolves.toEqual({ status: 'ok' });
    expect([...jar.values.keys()]).toEqual([]);
  });

  it('logoutAll reports a failure instead of pretending', async () => {
    const { auth, jar } = setup({ 'POST /auth/logout-all': ['network'] }, { hb_web_at: 'at-0' });
    await expect(auth.logoutAll()).resolves.toMatchObject({ status: 'error', code: 'NETWORK' });
    expect(jar.values.get('hb_web_at')).toBe('at-0');
  });

  it('lists sessions from an array or an {items} page', async () => {
    const row = {
      id: 's1',
      audience: 'web',
      userAgent: 'Firefox',
      ip: '203.0.113.7',
      createdAt: '2026-09-20T10:00:00.000Z',
      lastUsedAt: null,
      current: true,
    };
    const { auth } = setup(
      {
        'GET /auth/sessions': [
          { status: 200, body: [row] },
          { status: 200, body: { items: [row] } },
        ],
      },
      { hb_web_at: 'at-0' },
    );
    await expect(auth.listSessions()).resolves.toEqual([row]);
    await expect(auth.listSessions()).resolves.toEqual([row]);
  });

  it('revokeSession deletes by id and explains a 404', async () => {
    const { auth, api } = setup(
      {
        'DELETE /auth/sessions/s%2F1': [{ status: 204 }],
        'DELETE /auth/sessions/s2': [apiError(404, 'NOT_FOUND')],
      },
      { hb_web_at: 'at-0' },
    );
    await expect(auth.revokeSession({ id: 's/1' })).resolves.toEqual({ status: 'ok' });
    const missing = await auth.revokeSession('s2');
    expect(missing).toMatchObject({ status: 'error', code: 'NOT_FOUND' });
    if (missing.status === 'error') expect(missing.message).toMatch(/already signed out/);
    expect(api.calls).toHaveLength(2);
  });

  it('updateProfile validates the name and returns the fresh profile', async () => {
    const { auth, api } = setup(
      { 'PATCH /me': [{ status: 200, body: { ...ME, fullName: 'Ayesha K.' } }] },
      { hb_web_at: 'at-0' },
    );
    await expect(auth.updateProfile({ fullName: 'A' })).resolves.toMatchObject({
      status: 'error',
      fieldErrors: { fullName: expect.any(String) },
    });
    await expect(auth.updateProfile({ fullName: 'Ayesha K.' })).resolves.toMatchObject({
      status: 'ok',
      user: { fullName: 'Ayesha K.' },
    });
    expect(api.calls[0]?.body).toEqual({ fullName: 'Ayesha K.' });
  });

  it('resetPassword clears every auth cookie (the API ends all sessions)', async () => {
    const { auth, jar } = setup(
      {
        'POST /auth/password/forgot': [{ status: 202 }],
        'POST /auth/password/reset': [{ status: 204 }],
      },
      { hb_web_at: 'at-0', hb_web_rt: 'rt-0' },
    );
    await auth.forgotPassword({ identifier: 'ayesha@hb.test' });
    await expect(auth.getPending()).resolves.toMatchObject({ purpose: 'reset', channel: 'email' });
    await expect(
      auth.resetPassword({ code: '123456', newPassword: 'a brand new phrase' }),
    ).resolves.toEqual({ status: 'ok' });
    expect([...jar.values.keys()]).toEqual([]);
  });
});

describe('client IP forwarding', () => {
  async function forwardedFor(headers: Record<string, string>): Promise<string | undefined> {
    const { auth, api } = setup(
      { 'GET /me': [{ status: 200, body: ME }] },
      { hb_web_at: 'at-0' },
      { headers: async () => new Headers(headers) },
    );
    await auth.getSession();
    return api.calls[0]?.headers['x-forwarded-for'];
  }

  it('without a proxy, uses the address Next.js filled in from the socket', async () => {
    await expect(forwardedFor({ 'x-forwarded-for': '::ffff:127.0.0.1' })).resolves.toBe(
      '::ffff:127.0.0.1',
    );
  });

  it('counts TRUSTED_PROXY_HOPS from the right (Cloudflare → nginx → Next.js)', async () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', '2');
    await expect(
      forwardedFor({ 'x-forwarded-for': '6.6.6.6, 203.0.113.7, 172.70.1.1' }),
    ).resolves.toBe('203.0.113.7');
  });

  it('reads only CLIENT_IP_HEADER when it is set', async () => {
    vi.stubEnv('CLIENT_IP_HEADER', 'CF-Connecting-IP');
    await expect(
      forwardedFor({ 'cf-connecting-ip': '2001:db8::7', 'x-forwarded-for': '203.0.113.7' }),
    ).resolves.toBe('2001:db8::7');
    await expect(forwardedFor({ 'x-forwarded-for': '203.0.113.7' })).resolves.toBeUndefined();
  });

  it('drops values that are not an IP address (the API then sees one shared bucket)', async () => {
    await expect(forwardedFor({ 'x-forwarded-for': '203.0.113.7, x' })).resolves.toBeUndefined();
    await expect(forwardedFor({ 'x-forwarded-for': '999.1.1.1' })).resolves.toBeUndefined();
    await expect(forwardedFor({})).resolves.toBeUndefined();
  });
});

describe('apiFetch only refreshes for an unusable access token', () => {
  it('a wrong password on 2FA disable is sent once: no refresh, no second lockout strike', async () => {
    const { auth, api, jar } = setup(
      { 'POST /auth/2fa/disable': [apiError(401, 'INVALID_CREDENTIALS')] },
      { hb_web_at: 'at-0', hb_web_rt: 'rt-0' },
    );
    const result = await auth.disable2fa({ password: 'wrong-password', code: '123456' });
    expect(result).toMatchObject({ status: 'error', code: 'INVALID_CREDENTIALS' });
    expect(api.calls.map((c) => `${c.method} ${c.path}`)).toEqual(['POST /auth/2fa/disable']);
    expect(jar.values.get('hb_web_rt')).toBe('rt-0');
  });

  it('never presents the refresh token of a revoked session (it would look like token theft)', async () => {
    const { auth, api } = setup(
      { 'GET /me': [apiError(401, 'SESSION_REVOKED')] },
      { hb_web_at: 'at-0', hb_web_rt: 'rt-0' },
    );
    await expect(auth.getSession()).resolves.toBeNull();
    expect(api.count('POST /auth/refresh')).toBe(0);
  });
});

describe('second-factor code errors', () => {
  const noMessageSent = /check the latest message|ask for a new code/;

  it('challenge2fa: points to the authenticator app or an unused backup code', async () => {
    const { auth } = setup({
      'POST /auth/login': [
        {
          status: 200,
          body: { status: 'mfa_required', challengeToken: 'ch-1', expiresInSec: 300 },
        },
      ],
      'POST /auth/2fa/challenge': [apiError(400, 'INVALID_CODE')],
    });
    await auth.login({ identifier: 'a@b.pk', password: 'x' });
    const result = await auth.challenge2fa({ code: 'ABCDE-12345' });
    expect(result).toMatchObject({ status: 'error', code: 'INVALID_CODE' });
    if (result.status !== 'error') return;
    expect(result.message).toMatch(/authenticator app, or a backup code you haven’t used yet/);
    expect(result.message).not.toMatch(noMessageSent);
    expect(result.fieldErrors?.code).toBe(result.message);
  });

  it('enable2fa and disable2fa: no talk of messages or resending', async () => {
    const { auth } = setup(
      {
        'POST /auth/2fa/enable': [apiError(400, 'INVALID_CODE')],
        'POST /auth/2fa/disable': [apiError(400, 'INVALID_CODE')],
      },
      { hb_web_at: 'at-0' },
    );
    const enable = await auth.enable2fa({ code: '123456' });
    const disable = await auth.disable2fa({ password: 'long enough', code: '123456' });
    expect(enable).toMatchObject({ code: 'INVALID_CODE' });
    expect(disable).toMatchObject({ code: 'INVALID_CODE' });
    if (enable.status === 'error') expect(enable.message).toMatch(/authenticator app/);
    if (disable.status === 'error') expect(disable.message).toMatch(/backup code/);
    for (const r of [enable, disable]) {
      if (r.status === 'error') expect(r.message).not.toMatch(noMessageSent);
    }
  });
});

describe('adoptTokens', () => {
  const rotated = tokens(9);

  it('stores a pair issued outside the helpers with the session cookie options', async () => {
    const { auth, jar } = setup({}, { hb_web_at: 'at-0', hb_web_rt: 'rt-0' });
    await auth.adoptTokens(rotated);
    expect(jar.values.get('hb_web_at')).toBe('at-9');
    expect(jar.values.get('hb_web_rt')).toBe('rt-9');
    const at = jar.writes.find((w) => w.name === 'hb_web_at');
    const rt = jar.writes.find((w) => w.name === 'hb_web_rt');
    expect(at?.options).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 900,
    });
    expect(rt?.options).toMatchObject({ httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 });
  });

  it('clears a leftover 2FA step and code log-in, keeps a pending verify code', async () => {
    const { auth, jar } = setup({
      'POST /auth/otp/send': [
        { status: 202, body: { status: 'sent', expiresInSec: 300 } },
        { status: 202, body: { status: 'sent', expiresInSec: 300 } },
      ],
    });
    jar.values.set('hb_web_mfa', 'stale');
    await auth.sendOtp({ target: '03001234567', purpose: 'login' });
    await auth.adoptTokens(rotated);
    expect(jar.values.has('hb_web_mfa')).toBe(false);
    expect(jar.values.has('hb_web_pending')).toBe(false);

    await auth.sendOtp({ target: '03001234567', purpose: 'verify' });
    await auth.adoptTokens(rotated);
    await expect(auth.getPending()).resolves.toMatchObject({ purpose: 'verify' });
  });

  it('uses the audience cookie names and refuses read-only cookies', async () => {
    const jar = new FakeJar();
    const seller = createAuthCore(
      { audience: 'seller' },
      {
        cookies: async () => jar,
        headers: async () => new Headers(),
        redirect: (url: string): never => {
          throw new Redirected(url);
        },
        now: () => TEST_NOW,
      },
    );
    await seller.adoptTokens(rotated);
    expect([...jar.values.keys()].sort()).toEqual(['hb_seller_at', 'hb_seller_rt']);
    jar.readonly = true;
    await expect(seller.adoptTokens(rotated)).rejects.toThrow(/Server Action/);
  });
});

describe('sendContactVerification', () => {
  it('sends the code to the account’s own mobile number, never to one from the form', async () => {
    const { auth, api } = setup(
      {
        'GET /me': [{ status: 200, body: ME }],
        'POST /auth/otp/send': [{ status: 202, body: { status: 'sent', expiresInSec: 300 } }],
      },
      { hb_web_at: 'at-0' },
    );
    const sent = await auth.sendContactVerification({
      channel: 'sms',
      target: '+923339999999',
      next: '/security',
    });
    expect(sent).toEqual({ status: 'sent', channel: 'sms', target: '•••• 567', expiresInSec: 300 });
    expect(api.calls[1]?.body).toEqual({
      audience: 'web',
      channel: 'sms',
      target: '+923001234567',
      purpose: 'verify',
    });
    await expect(auth.getPending()).resolves.toMatchObject({
      purpose: 'verify',
      next: '/security',
    });
  });

  it('explains a missing address and a missing session without calling otp/send', async () => {
    const { auth, api } = setup(
      { 'GET /me': [{ status: 200, body: { ...ME, phone: null } }] },
      { hb_web_at: 'at-0' },
    );
    const noPhone = await auth.sendContactVerification({ channel: 'sms' });
    expect(noPhone).toMatchObject({ status: 'error', code: 'VALIDATION_FAILED' });
    if (noPhone.status === 'error')
      expect(noPhone.message).toBe('There’s no mobile number on your account to confirm yet.');
    const signedOut = setup({});
    await expect(
      signedOut.auth.sendContactVerification({ channel: 'email' }),
    ).resolves.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    expect(api.count('POST /auth/otp/send')).toBe(0);
  });
});

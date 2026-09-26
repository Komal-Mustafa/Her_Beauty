// @hb/auth/middleware — edge-safe entry for each app's middleware.ts (docs/b2-auth.md §7).
// Never imports server-only, qrcode or Node APIs. It never trusts the JWT: it only reads `exp` to
// decide whether a refresh is worth trying; the API verifies every token.
import { TokenPair, type AuthAudience } from '@hb/types';
import { NextResponse, type NextRequest } from 'next/server';
import { clearCookie, cookieNames, writeTokenCookies, type SameSite } from './cookies';
import { ApiRequestError } from './errors';
import { callApi, clientForwardHeaders, type FetchLike } from './http';
import { accessTokenLooksLive } from './jwt';
import { refreshOnce } from './refresh';
import { safeNextPath } from './safe-next';

export type AuthMiddlewareConfig = {
  /** Must match the app's createAuth() audience. */
  audience: AuthAudience;
  sameSite: SameSite;
  /** Path prefixes that need a session, e.g. ["/account"] (matches "/account" and "/account/…"). */
  protectedPrefixes: readonly string[];
  /** Default "/login". */
  loginPath?: string;
  /** Test hook; defaults to global fetch. */
  fetch?: FetchLike;
  /** Test hook; defaults to Date.now. */
  now?: () => number;
};

export function isProtectedPath(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((raw) => {
    const prefix = raw.replace(/\/+$/, '') || '/';
    return prefix === '/' || pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}

/** Router prefetches must never rotate the refresh token (parallel prefetches look like reuse). */
function isPrefetch(req: NextRequest): boolean {
  return (
    req.headers.get('next-router-prefetch') === '1' ||
    req.headers.get('purpose') === 'prefetch' ||
    (req.headers.get('sec-purpose') ?? '').includes('prefetch')
  );
}

/** Request headers for the page render with the refreshed cookies swapped in. */
function headersWithCookies(req: NextRequest, updates: Record<string, string>): Headers {
  const headers = new Headers(req.headers);
  const jar = new Map(req.cookies.getAll().map((c) => [c.name, c.value]));
  for (const [name, value] of Object.entries(updates)) jar.set(name, value);
  headers.set(
    'cookie',
    [...jar].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join('; '),
  );
  return headers;
}

export function createAuthMiddleware(config: AuthMiddlewareConfig) {
  const loginPath = config.loginPath ?? '/login';
  const now = config.now ?? Date.now;

  function redirectToLogin(req: NextRequest, clear: boolean): NextResponse {
    const next = safeNextPath(`${req.nextUrl.pathname}${req.nextUrl.search}`, '/');
    const url = new URL(loginPath, req.url);
    url.search = `?next=${encodeURIComponent(next)}`;
    const res = NextResponse.redirect(url);
    if (clear) {
      const names = cookieNames();
      for (const name of [names.access, names.refresh]) {
        if (req.cookies.has(name)) clearCookie(res.cookies, name, config.sameSite);
      }
    }
    return res;
  }

  return async function authMiddleware(req: NextRequest): Promise<NextResponse> {
    if (!isProtectedPath(req.nextUrl.pathname, config.protectedPrefixes)) {
      return NextResponse.next();
    }
    const names = cookieNames();
    if (accessTokenLooksLive(req.cookies.get(names.access)?.value, now())) {
      return NextResponse.next();
    }
    const refreshToken = req.cookies.get(names.refresh)?.value;
    if (!refreshToken) return redirectToLogin(req, false);
    if (isPrefetch(req)) return NextResponse.next();

    let tokens: TokenPair;
    try {
      tokens = await refreshOnce(
        refreshToken,
        () =>
          callApi('/auth/refresh', TokenPair, {
            method: 'POST',
            body: { refreshToken },
            forward: clientForwardHeaders(req.headers),
            fetch: config.fetch,
          }),
        now,
      );
    } catch (error) {
      if (error instanceof ApiRequestError && (error.status === 401 || error.status === 400)) {
        return redirectToLogin(req, true);
      }
      // API unreachable or busy: let the page decide (it shows its own error state).
      return NextResponse.next();
    }

    const res = NextResponse.next({
      request: {
        headers: headersWithCookies(req, {
          [names.access]: tokens.accessToken,
          [names.refresh]: tokens.refreshToken,
        }),
      },
    });
    writeTokenCookies(res.cookies, names, tokens, config.sameSite, now());
    return res;
  };
}

export { safeNextPath } from './safe-next';
export { accessTokenLooksLive, jwtExpiry } from './jwt';

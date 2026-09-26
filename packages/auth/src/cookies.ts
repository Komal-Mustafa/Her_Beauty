// Cookie names and options (docs/b2-auth.md §7). Edge-safe: shared by the server helpers and the
// middleware entry.
import type { AuthAudience, TokenPair } from '@hb/types';
import { isProduction } from './env';

export type SameSite = 'lax' | 'strict';

/**
 * SameSite comes from the audience, never from app config (security.md §4, b2-auth §7):
 * Strict for the admin console, Lax for the shop and the seller portal.
 */
export function sameSiteFor(audience: AuthAudience): SameSite {
  return audience === 'admin' ? 'strict' : 'lax';
}

export type CookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: SameSite;
  path: '/';
  maxAge: number;
};

export type CookieNames = {
  /** Access token (JWT, 15 min). */
  access: string;
  /** Refresh token (rotating, 12 h – 30 days by audience). */
  refresh: string;
  /** 5-minute 2FA challenge token between the password step and the code step. */
  mfa: string;
  /** Pending verification (target/channel/purpose) for the code pages, 15 minutes. */
  pending: string;
};

/** 2FA challenge tokens live 5 minutes (b2-auth §3). */
export const MFA_COOKIE_MAX_AGE_SEC = 5 * 60;
/** Pending verification state for /verify and /reset-password. */
export const PENDING_COOKIE_MAX_AGE_SEC = 15 * 60;

/**
 * `hb_<audience>_at` etc. The audience keeps the three apps apart where they share a cookie jar
 * (localhost ports in development). In production the `__Host-` prefix is added on top: Secure,
 * path=/ and no Domain, so subdomains never share or overwrite them either.
 */
export function cookieNames(
  audience: AuthAudience,
  production: boolean = isProduction(),
): CookieNames {
  const base = `${production ? '__Host-' : ''}hb_${audience}`;
  return {
    access: `${base}_at`,
    refresh: `${base}_rt`,
    mfa: `${base}_mfa`,
    pending: `${base}_pending`,
  };
}

export function cookieOptions(
  sameSite: SameSite,
  maxAgeSec: number,
  production: boolean = isProduction(),
): CookieOptions {
  return {
    httpOnly: true,
    secure: production,
    sameSite,
    path: '/',
    maxAge: Math.max(0, Math.floor(maxAgeSec)),
  };
}

/** Whole seconds from `now` until an ISO datetime (never negative). */
export function secondsUntil(iso: string, now: number): number {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return 0;
  return Math.max(0, Math.floor((at - now) / 1000));
}

/** The part of next/headers `cookies()` and `NextResponse.cookies` that writes a cookie. */
export interface CookieWriter {
  set(name: string, value: string, options: CookieOptions): unknown;
}

export function writeTokenCookies(
  jar: CookieWriter,
  names: CookieNames,
  tokens: TokenPair,
  sameSite: SameSite,
  now: number,
): void {
  jar.set(
    names.access,
    tokens.accessToken,
    cookieOptions(sameSite, secondsUntil(tokens.accessExpiresAt, now)),
  );
  jar.set(
    names.refresh,
    tokens.refreshToken,
    cookieOptions(sameSite, secondsUntil(tokens.refreshExpiresAt, now)),
  );
}

/**
 * Expire a cookie with the same attributes it was set with: browsers ignore a `__Host-` deletion
 * that lacks Secure or path=/.
 */
export function clearCookie(jar: CookieWriter, name: string, sameSite: SameSite): void {
  jar.set(name, '', cookieOptions(sameSite, 0));
}

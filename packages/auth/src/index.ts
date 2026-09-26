// @hb/auth — server-side auth for the web, seller and admin Next.js apps (BFF: tokens never reach
// browser JavaScript). Design: docs/b2-auth.md §7. Usage: packages/auth/README.md.
// Middleware code imports "@hb/auth/middleware" instead (edge-safe, no server-only).
import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createAuthCore, type Auth, type AuthConfig, type CookieJar } from './core';

/** One instance per app, e.g. `export const auth = createAuth({ audience: 'web', sameSite: 'lax' })`. */
export function createAuth(config: AuthConfig): Auth {
  return createAuthCore(config, {
    cookies: async (): Promise<CookieJar> => cookies(),
    headers: () => headers(),
    redirect: (url) => redirect(url),
    memo: (fn) => cache(fn),
  });
}

export {
  createAuthCore,
  RESEND_COOLDOWN_SEC,
  type ApiFetchInit,
  type Auth,
  type AuthConfig,
  type AuthDeps,
  type CookieJar,
  type MfaView,
  type PendingView,
} from './core';
export {
  cookieNames,
  cookieOptions,
  type CookieNames,
  type CookieOptions,
  type SameSite,
} from './cookies';
export {
  ApiRequestError,
  friendlyMessage,
  type ApiErrorDetails,
  type AuthResultCode,
  type LocalErrorCode,
} from './errors';
export { IgnoreBody, type Schema } from './http';
export { qrSvgDataUrl } from './qr';
export {
  isAuthError,
  type AuthError,
  type CodeSentState,
  type DoneState,
  type FieldErrors,
  type FormValues,
  type LoginOutcome,
  type LoginResultState,
  type ProfileState,
  type RegisterResultState,
  type TwoFactorEnableState,
  type TwoFactorSetupState,
  type VerifyResultState,
} from './results';
export { safeNextPath } from './safe-next';
export type { PendingPurpose } from './state-cookies';

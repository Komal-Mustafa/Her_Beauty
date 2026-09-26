import { cookieNames, cookieOptions } from '@hb/auth';
import type { TokenPair } from '@hb/types';
import { cookies } from 'next/headers';
import { auth } from './auth';

function secondsUntil(iso: string): number {
  const at = Date.parse(iso);
  return Number.isNaN(at) ? 0 : Math.max(0, Math.floor((at - Date.now()) / 1000));
}

/**
 * Stores a token pair the API issued outside the login helpers. POST /seller/application
 * rotates the session (the old refresh token is revoked, so presenting it again would look like
 * token theft and end every session): its new tokens must replace the cookies at once. Same
 * names and attributes as @hb/auth (httpOnly, SameSite from the config, __Host- in production).
 * Server actions and route handlers only (cookies are read-only in server components).
 */
export async function storeTokens(tokens: TokenPair): Promise<void> {
  const jar = await cookies();
  const names = cookieNames();
  const { sameSite } = auth.config;
  jar.set(
    names.access,
    tokens.accessToken,
    cookieOptions(sameSite, secondsUntil(tokens.accessExpiresAt)),
  );
  jar.set(
    names.refresh,
    tokens.refreshToken,
    cookieOptions(sameSite, secondsUntil(tokens.refreshExpiresAt)),
  );
}

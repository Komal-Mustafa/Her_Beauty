import { cookieNames, createAuth } from '@hb/auth';
import type { Me } from '@hb/types';
import { cookies } from 'next/headers';

/** Seller portal auth (docs/b2-auth.md §1, §7): audience "seller", SameSite=Lax, 7-day sessions. */
export const auth = createAuth({
  audience: 'seller',
  loginPath: '/login',
  homePath: '/dashboard',
});

/**
 * For pages that only want to skip a step when someone is already signed in (e.g. /login).
 * An unreachable API counts as signed out here; the form itself reports the outage on submit.
 */
export async function signedInUser(): Promise<Me | null> {
  try {
    return await auth.getSession();
  } catch {
    return null;
  }
}

/**
 * Whether this browser holds session cookies at all (no API call). A server component cannot
 * refresh an expired access token, so "/" sends anyone with a refresh cookie to /dashboard and
 * lets the middleware refresh (or send them to /login when the session is gone).
 */
export async function hasSessionCookies(): Promise<boolean> {
  const jar = await cookies();
  const names = cookieNames(auth.config.audience);
  return Boolean(jar.get(names.access)?.value || jar.get(names.refresh)?.value);
}

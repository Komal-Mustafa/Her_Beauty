import { createAuth } from '@hb/auth';
import type { Me } from '@hb/types';

/** Customer-site auth (docs/b2-auth.md §7): SameSite=Lax cookies, 30-day sessions. */
export const auth = createAuth({
  audience: 'web',
  sameSite: 'lax',
  loginPath: '/login',
  homePath: '/account',
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

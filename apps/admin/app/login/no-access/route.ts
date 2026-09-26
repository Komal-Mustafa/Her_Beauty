import { ApiRequestError, IgnoreBody } from '@hb/auth';
import { redirect } from 'next/navigation';
import { auth, isAdminRole } from '@/lib/auth';

// Where the console sends a session the API refuses (403 on /admin/overview, or a non-admin
// role): log it out and show the login page with a neutral message. A route handler because
// server components cannot change cookies. It lives under /login so the middleware skips it.

export const dynamic = 'force-dynamic';

type Access = 'signed-out' | 'allowed' | 'refused';

/**
 * Re-checks with the API before logging out, so a stray link to this URL cannot sign out an admin
 * who does have access. Any doubt (refused, API unreachable) counts as no access.
 */
async function consoleAccess(): Promise<Access> {
  try {
    const me = await auth.getSession();
    if (!me) return 'signed-out';
    if (!isAdminRole(me.role)) return 'refused';
    await auth.apiFetch('/admin/overview', IgnoreBody);
    return 'allowed';
  } catch (error) {
    if (error instanceof ApiRequestError) return 'refused';
    throw error;
  }
}

export async function GET(): Promise<never> {
  const access = await consoleAccess();
  if (access === 'allowed') redirect('/');
  await auth.logout();
  redirect(access === 'refused' ? '/login?notice=no-access' : '/login');
}

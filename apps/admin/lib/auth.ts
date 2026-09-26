import { createAuth } from '@hb/auth';
import { ADMIN_ROLES, type Me, type UserRole } from '@hb/types';

/**
 * Admin console auth (docs/b2-auth.md §1, §7): audience "admin" (hb_admin_* cookies, always
 * SameSite=Strict), 12-hour sessions, 2FA always (the API answers mfa_required /
 * mfa_setup_required).
 */
export const auth = createAuth({
  audience: 'admin',
  loginPath: '/login',
  homePath: '/',
});

/** Where a session that may not use the console is signed out (route handler, see there). */
export const NO_ACCESS_PATH = '/login/no-access';

export function isAdminRole(role: UserRole): boolean {
  return (ADMIN_ROLES as readonly UserRole[]).includes(role);
}

const ROLE_LABELS: Record<UserRole, string> = {
  customer: 'Customer',
  seller: 'Seller',
  support: 'Support',
  finance: 'Finance',
  admin: 'Admin',
  super_admin: 'Super admin',
};

export function roleLabel(role: UserRole): string {
  return ROLE_LABELS[role];
}

/**
 * For /login only: an admin who is already signed in skips the form. Anyone else (no session, a
 * non-admin role, or an unreachable API) sees the form; the console itself re-checks access.
 */
export async function signedInAdmin(): Promise<Me | null> {
  try {
    const me = await auth.getSession();
    return me && isAdminRole(me.role) ? me : null;
  } catch {
    return null;
  }
}

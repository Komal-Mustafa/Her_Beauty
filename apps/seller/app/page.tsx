import { redirect } from 'next/navigation';
import { hasSessionCookies } from '@/lib/auth';

/**
 * "/" → /dashboard when this browser holds a session, else /login. No API call here: the
 * middleware on /dashboard refreshes an expired access token or sends a dead session to login.
 */
export default async function SellerRoot() {
  redirect((await hasSessionCookies()) ? '/dashboard' : '/login');
}

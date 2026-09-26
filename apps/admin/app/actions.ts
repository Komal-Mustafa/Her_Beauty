'use server';

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

/** Ends this browser's admin session (cookies are cleared even if the API is unreachable). */
export async function logoutAction(): Promise<void> {
  await auth.logout();
  redirect('/login?notice=signed-out');
}

import { safeNextPath } from '@hb/auth';
import { Alert } from '@hb/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { signedInUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Log in' };

const NOTICES: Record<string, string> = {
  'password-reset': 'Your password is changed. Log in with your new password.',
  'signed-out': 'You’re logged out. See you soon.',
  'signed-out-everywhere': 'You’re signed out on every device.',
};

type Search = { next?: string; notice?: string };

/** 04-ui-ux §6.5 seller login (split screen from the (auth) layout). */
export default async function SellerLoginPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next, '/dashboard');
  if (await signedInUser()) redirect(next);

  const notice = params.notice ? NOTICES[params.notice] : undefined;
  return (
    <>
      <h1 className="font-display text-[34px] font-semibold leading-tight text-ink-900">
        Welcome back
      </h1>
      <p className="mt-2 text-ink-500">Log in to manage your store, products, orders and ads.</p>
      {notice && (
        <Alert tone="success" className="mt-6">
          {notice}
        </Alert>
      )}
      <div className="mt-8">
        <LoginForm next={next} />
      </div>
      <p className="mt-8 text-center text-sm text-ink-500">
        New to Her Beauty?{' '}
        <Link
          href="/register"
          className="inline-flex min-h-11 items-center font-medium text-pink-600 hover:underline"
        >
          Register as a vendor or manufacturer
        </Link>
      </p>
    </>
  );
}

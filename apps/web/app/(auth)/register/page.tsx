import { safeNextPath } from '@hb/auth';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { RegisterForm } from '@/components/auth/register-form';
import { signedInUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Create an account' };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next, '/account');
  if (await signedInUser()) redirect(next);
  const loginHref = params.next ? `/login?next=${encodeURIComponent(next)}` : '/login';
  return (
    <>
      <h1 className="font-display text-[34px] font-semibold leading-tight text-ink-900">
        Create your account
      </h1>
      <p className="mt-2 text-ink-500">
        Save favourites, track orders and check out faster. We’ll send a code to confirm it’s you.
      </p>
      <div className="mt-8">
        <RegisterForm next={next} />
      </div>
      <p className="mt-8 text-center text-sm text-ink-500">
        Already have an account?{' '}
        <Link href={loginHref} className="font-medium text-pink-600 hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}

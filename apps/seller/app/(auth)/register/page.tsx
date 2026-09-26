import { SellerType } from '@hb/types';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { RegisterForm } from '@/components/auth/register-form';
import { signedInUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Register as a seller' };

export default async function SellerRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const params = await searchParams;
  // Signed-in users start an application from the dashboard instead of a second account.
  if (await signedInUser()) redirect('/dashboard');
  const type = SellerType.safeParse(params.type);
  return (
    <>
      <p className="eyebrow mb-2 text-gold-800">Sell on Her Beauty</p>
      <h1 className="font-display text-[34px] font-semibold leading-tight text-ink-900">
        Open your seller account
      </h1>
      <p className="mt-2 text-ink-500">
        Tell us how you sell and create your login. Business details and documents come next, from
        your dashboard.
      </p>
      <div className="mt-8">
        <RegisterForm defaultType={type.success ? type.data : undefined} />
      </div>
      <p className="mt-8 text-center text-sm text-ink-500">
        Already selling with us?{' '}
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center font-medium text-pink-600 hover:underline"
        >
          Log in
        </Link>
      </p>
    </>
  );
}

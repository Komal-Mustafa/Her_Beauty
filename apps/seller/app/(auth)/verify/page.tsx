import type { Metadata } from 'next';
import Link from 'next/link';
import { ResendCode } from '@/components/auth/resend-code';
import { VerifyAgainForm, VerifyForm } from '@/components/auth/verify-form';
import { auth } from '@/lib/auth';

export const metadata: Metadata = { title: 'Enter your code' };

export default async function SellerVerifyPage() {
  const pending = await auth.getPending();

  if (!pending || pending.purpose === 'reset') {
    return (
      <>
        <h1 className="font-display text-[34px] font-semibold leading-tight text-ink-900">
          Let’s send a new code
        </h1>
        <p className="mt-2 text-ink-500">
          Codes work for a short time only. Enter the email you registered with and we’ll send a
          fresh code to finish setting up your seller account.
        </p>
        <div className="mt-8">
          <VerifyAgainForm />
        </div>
        <p className="mt-8 text-center text-sm text-ink-500">
          New here?{' '}
          <Link
            href="/register"
            className="inline-flex min-h-11 items-center font-medium text-pink-600 hover:underline"
          >
            Register as a seller
          </Link>
        </p>
      </>
    );
  }

  const by = pending.channel === 'sms' ? 'text message' : 'email';
  return (
    <>
      <h1 className="font-display text-[34px] font-semibold leading-tight text-ink-900">
        Confirm your {pending.channel === 'sms' ? 'mobile number' : 'email'}
      </h1>
      <p className="mt-2 text-ink-500">
        We sent a 6-digit code by {by} to{' '}
        <span className="font-medium text-ink-900">{pending.target}</span>. It works for 5 minutes.
      </p>
      <div className="mt-8">
        <VerifyForm />
      </div>
      <ResendCode resendInSec={pending.resendInSec} />
      <p className="mt-6 text-sm">
        <Link
          href="/register"
          className="inline-flex min-h-11 items-center font-medium text-pink-600 hover:underline"
        >
          Start again with different details
        </Link>
      </p>
    </>
  );
}

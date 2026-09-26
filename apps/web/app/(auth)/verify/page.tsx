import { ResendCode } from '@hb/auth/client';
import { Alert, Button } from '@hb/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { resendCodeAction } from '@/app/(auth)/actions';
import { VerifyForm } from '@/components/auth/verify-form';
import { auth } from '@/lib/auth';

export const metadata: Metadata = { title: 'Enter your code' };

export default async function VerifyPage() {
  const pending = await auth.getPending();

  if (!pending || pending.purpose === 'reset') {
    return (
      <>
        <h1 className="font-display text-[34px] font-semibold leading-tight text-ink-900">
          Let’s send a new code
        </h1>
        <Alert tone="info" className="mt-6">
          Your code request timed out after 15 minutes. Start again and we’ll send a fresh code.
        </Alert>
        <div className="mt-6 flex flex-col gap-3">
          <Button asChild block>
            <Link href="/login?method=code">Log in with a mobile code</Link>
          </Button>
          <Button asChild block variant="secondary">
            <Link href="/register">Create an account</Link>
          </Button>
        </div>
      </>
    );
  }

  const by = pending.channel === 'sms' ? 'text message' : 'email';
  // A code asked for on the account page confirms a contact of a signed-in customer: going back
  // is the way out. Other codes can start again with a different number or email.
  const fromAccount = pending.purpose === 'contact';
  const changeHref = fromAccount
    ? pending.next
    : pending.purpose === 'login'
      ? '/login?method=code'
      : '/register';
  const changeLabel = fromAccount
    ? 'Back to your account'
    : pending.channel === 'sms'
      ? 'Use a different number'
      : 'Use a different email';
  const heading = pending.needsName
    ? 'One last step'
    : fromAccount
      ? `Confirm your ${pending.channel === 'sms' ? 'mobile number' : 'email'}`
      : 'Enter your code';
  return (
    <>
      <h1 className="font-display text-[34px] font-semibold leading-tight text-ink-900">
        {heading}
      </h1>
      {!pending.needsName && (
        <p className="mt-2 text-ink-500">
          We sent a 6-digit code by {by} to{' '}
          <span className="font-medium text-ink-900">{pending.target}</span>. It works for 5
          minutes.
        </p>
      )}
      <div className="mt-8">
        <VerifyForm needsName={pending.needsName} />
      </div>
      {!pending.needsName && (
        <ResendCode action={resendCodeAction} resendInSec={pending.resendInSec} />
      )}
      <p className="mt-6 text-sm">
        <Link
          href={changeHref}
          prefetch={fromAccount ? false : undefined}
          className="inline-flex min-h-11 items-center font-medium text-pink-600 hover:underline"
        >
          {changeLabel}
        </Link>
      </p>
    </>
  );
}

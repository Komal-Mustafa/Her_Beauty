import { Alert, Button } from '@hb/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ResetPasswordForm } from '@/components/auth/password-reset-forms';
import { ResendCode } from '@/components/auth/resend-code';
import { auth } from '@/lib/auth';

export const metadata: Metadata = { title: 'Choose a new password' };

export default async function ResetPasswordPage() {
  const pending = await auth.getPending();

  if (!pending || pending.purpose !== 'reset') {
    return (
      <>
        <h1 className="font-display text-[34px] font-semibold leading-tight text-ink-900">
          Let’s send a new code
        </h1>
        <Alert tone="info" className="mt-6">
          Your reset request timed out after 15 minutes. Ask for a new code to continue.
        </Alert>
        <Button asChild block className="mt-6">
          <Link href="/forgot-password">Send a new code</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <h1 className="font-display text-[34px] font-semibold leading-tight text-ink-900">
        Choose a new password
      </h1>
      <p className="mt-2 text-ink-500">
        If <span className="font-medium text-ink-900">{pending.target}</span> has an account, we
        sent it a 6-digit code. It works for 5 minutes. Saving a new password signs you out on every
        device.
      </p>
      <div className="mt-8">
        <ResetPasswordForm />
      </div>
      <ResendCode resendInSec={pending.resendInSec} />
      <p className="mt-6 text-sm">
        <Link
          href="/forgot-password"
          className="inline-flex min-h-11 items-center font-medium text-pink-600 hover:underline"
        >
          Use a different email or number
        </Link>
      </p>
    </>
  );
}

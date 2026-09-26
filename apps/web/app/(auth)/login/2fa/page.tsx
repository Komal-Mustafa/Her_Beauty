import { TwoFactorForm } from '@hb/auth/client';
import { Alert, Button } from '@hb/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { twoFactorChallengeAction } from '@/app/(auth)/actions';
import { auth } from '@/lib/auth';

export const metadata: Metadata = { title: 'Two-factor check' };

export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ backup?: string }>;
}) {
  const [{ backup }, challenge] = await Promise.all([searchParams, auth.getMfaChallenge()]);

  if (!challenge || challenge.kind !== 'mfa') {
    return (
      <>
        <h1 className="font-display text-[34px] font-semibold leading-tight text-ink-900">
          Log in again
        </h1>
        <Alert tone="info" className="mt-6">
          Your sign-in step timed out after 5 minutes. Log in again and we’ll ask for a fresh code.
        </Alert>
        <Button asChild block className="mt-6">
          <Link href="/login">Go to log in</Link>
        </Button>
      </>
    );
  }

  const useBackup = backup === '1';
  return (
    <>
      <h1 className="font-display text-[34px] font-semibold leading-tight text-ink-900">
        Confirm it’s you
      </h1>
      <p className="mt-2 text-ink-500">
        {useBackup
          ? 'Enter one of the backup codes you saved when you turned on two-factor.'
          : 'Open your authenticator app and enter the 6-digit code for Her Beauty.'}
      </p>
      <div className="mt-8">
        <TwoFactorForm
          key={useBackup ? 'backup' : 'totp'}
          action={twoFactorChallengeAction}
          backup={useBackup}
        />
      </div>
      <div className="mt-6 flex flex-col items-center gap-1 text-sm">
        <Link
          href={useBackup ? '/login/2fa' : '/login/2fa?backup=1'}
          className="inline-flex min-h-11 items-center font-medium text-pink-600 hover:underline"
        >
          {useBackup ? 'Use your authenticator app instead' : 'Use a backup code instead'}
        </Link>
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center text-ink-500 hover:text-ink-900 hover:underline"
        >
          Start over
        </Link>
      </div>
    </>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthCard, StartOver } from '@/components/auth/auth-card';
import { TwoFactorForm } from '@/components/auth/two-factor-form';
import { auth } from '@/lib/auth';
import { TIMED_OUT } from '@/lib/auth-copy';

export const metadata: Metadata = { title: 'Two-step verification' };

/** Step 2 for admins who have 2FA: a code from the authenticator app, or a backup code. */
export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ backup?: string }>;
}) {
  const [{ backup }, challenge] = await Promise.all([searchParams, auth.getMfaChallenge()]);
  if (challenge?.kind === 'mfa_setup') redirect('/login/2fa/setup');

  if (!challenge) {
    return (
      <AuthCard>
        <StartOver message={TIMED_OUT} />
      </AuthCard>
    );
  }

  const useBackup = backup === '1';
  const startOver =
    challenge.next === '/' ? '/login' : `/login?next=${encodeURIComponent(challenge.next)}`;
  return (
    <AuthCard>
      <h1 className="font-display text-[28px] font-medium leading-tight text-ink-900">
        Enter your code
      </h1>
      <p className="mt-2 text-sm text-ink-500">
        {useBackup
          ? 'Enter one of the backup codes you saved when you set up two-step verification.'
          : 'Open your authenticator app and enter the 6-digit code for Her Beauty.'}
      </p>
      <div className="mt-6">
        <TwoFactorForm key={useBackup ? 'backup' : 'totp'} backup={useBackup} />
      </div>
      <div className="mt-4 flex flex-col items-center text-sm">
        <Link
          href={useBackup ? '/login/2fa' : '/login/2fa?backup=1'}
          className="inline-flex min-h-11 items-center font-medium text-pink-600 hover:underline"
        >
          {useBackup ? 'Use your authenticator app instead' : 'Use a backup code instead'}
        </Link>
        <Link
          href={startOver}
          className="inline-flex min-h-11 items-center text-ink-500 hover:text-ink-900 hover:underline"
        >
          Start over
        </Link>
      </div>
    </AuthCard>
  );
}

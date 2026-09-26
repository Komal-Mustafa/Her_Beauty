import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/auth/auth-card';
import { TwoFactorSetup } from '@/components/auth/two-factor-setup';
import { auth } from '@/lib/auth';

export const metadata: Metadata = { title: 'Set up two-step verification' };

/**
 * First admin sign-in: the API answered mfa_setup_required, so hb_mfa holds a setup token.
 * Rendering creates nothing; the TOTP secret is only requested when the admin starts the setup.
 */
export default async function TwoFactorSetupPage() {
  const challenge = await auth.getMfaChallenge();
  if (challenge?.kind === 'mfa') redirect('/login/2fa');

  // Always the same element: enabling 2FA signs the admin in (new cookies), Next re-renders this
  // page without a challenge, and the backup codes in TwoFactorSetup's state must survive.
  return (
    <AuthCard wide>
      <TwoFactorSetup ready={challenge?.kind === 'mfa_setup'} />
    </AuthCard>
  );
}

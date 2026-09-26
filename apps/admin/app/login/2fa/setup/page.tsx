import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/auth/auth-card';
import { TwoFactorSetup } from '@/components/auth/two-factor-setup';
import { auth, signedInAdmin } from '@/lib/auth';

export const metadata: Metadata = { title: 'Set up two-step verification' };

/**
 * First admin sign-in: the API answered mfa_setup_required, so hb_admin_mfa holds a setup token.
 * Rendering creates nothing; the TOTP secret is only requested when the admin starts the setup.
 */
export default async function TwoFactorSetupPage() {
  const challenge = await auth.getMfaChallenge();
  if (challenge?.kind === 'mfa') redirect('/login/2fa');

  // Without a setup challenge, an admin who is signed in with 2FA on has just finished the setup
  // (and reloaded the backup-codes step): tell them so instead of "your sign-in timed out".
  const ready = challenge?.kind === 'mfa_setup';
  const alreadyOn = !ready && (await signedInAdmin())?.twoFactorEnabled === true;

  // Always the same element: enabling 2FA signs the admin in (new cookies), Next re-renders this
  // page without a challenge, and the backup codes in TwoFactorSetup's state must survive.
  return (
    <AuthCard wide>
      <TwoFactorSetup ready={ready} alreadyOn={alreadyOn} />
    </AuthCard>
  );
}

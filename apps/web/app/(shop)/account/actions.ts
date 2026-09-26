'use server';

import type { AuthError, CodeSentState, DoneState, ProfileState } from '@hb/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

// Account page actions. Every call is authenticated with the session cookies (Bearer to the
// API); the user id always comes from the token, never from the form.

export async function updateProfileAction(
  _prev: ProfileState | null,
  formData: FormData,
): Promise<ProfileState> {
  const result = await auth.updateProfile(formData);
  if (result.status === 'ok') revalidatePath('/account');
  return result;
}

/** Sends a code to confirm the email or mobile number on the account, then opens /verify. */
export async function sendVerificationAction(
  _prev: CodeSentState | null,
  formData: FormData,
): Promise<CodeSentState> {
  const result = await auth.sendOtp(formData);
  if (result.status === 'sent') redirect('/verify');
  return result;
}

export type TwoFactorPanelState =
  | { step: 'scan'; secret: string; qrDataUrl: string; error?: AuthError }
  | { step: 'codes'; backupCodes: string[] }
  | { step: 'failed'; error: AuthError }
  | null;

const QR_PREFIX = 'data:image/svg+xml;base64,';

/** One action for the whole enrolment: setup → scan + first code → backup codes → done. */
export async function twoFactorAction(
  prev: TwoFactorPanelState,
  formData: FormData,
): Promise<TwoFactorPanelState> {
  const intent = formData.get('intent');
  if (intent === 'setup') {
    const result = await auth.setup2fa();
    return result.status === 'ok'
      ? { step: 'scan', secret: result.secret, qrDataUrl: result.qrDataUrl }
      : { step: 'failed', error: result };
  }
  if (intent === 'enable' && prev?.step === 'scan' && prev.qrDataUrl.startsWith(QR_PREFIX)) {
    const result = await auth.enable2fa(formData);
    if (result.status === 'ok') {
      revalidatePath('/account');
      return { step: 'codes', backupCodes: result.backupCodes };
    }
    return { step: 'scan', secret: prev.secret, qrDataUrl: prev.qrDataUrl, error: result };
  }
  return null; // "I saved these codes" / "Cancel"
}

export async function disableTwoFactorAction(
  _prev: DoneState | null,
  formData: FormData,
): Promise<DoneState> {
  const result = await auth.disable2fa(formData);
  if (result.status === 'ok') revalidatePath('/account');
  return result;
}

export async function revokeSessionAction(
  _prev: DoneState | null,
  formData: FormData,
): Promise<DoneState> {
  const result = await auth.revokeSession(formData);
  if (result.status === 'ok') revalidatePath('/account');
  return result;
}

export async function logoutAction(): Promise<void> {
  await auth.logout();
  redirect('/');
}

export async function logoutAllAction(_prev: DoneState | null): Promise<DoneState> {
  const result = await auth.logoutAll();
  if (result.status === 'ok') redirect('/login?notice=signed-out-everywhere');
  return result;
}

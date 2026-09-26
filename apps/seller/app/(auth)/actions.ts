'use server';

import type {
  CodeSentState,
  DoneState,
  LoginResultState,
  RegisterResultState,
  VerifyResultState,
} from '@hb/auth';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

// Server actions for the seller sign-in pages (useActionState: pending + errors, and the forms
// still post without JavaScript). Next.js rejects cross-origin action posts (our CSRF guard,
// b2-auth §7). redirect() must stay outside try/catch: it works by throwing.

export async function loginAction(
  _prev: LoginResultState | null,
  formData: FormData,
): Promise<LoginResultState> {
  const result = await auth.login(formData);
  if (result.status === 'ok') redirect(result.next);
  if (result.status === 'mfa_required' || result.status === 'mfa_setup_required') {
    redirect('/login/2fa');
  }
  return result;
}

export async function twoFactorChallengeAction(
  _prev: LoginResultState | null,
  formData: FormData,
): Promise<LoginResultState> {
  const result = await auth.challenge2fa(formData);
  if (result.status === 'ok') redirect(result.next);
  return result;
}

/** Vendor or Manufacturer account + draft store in one step; the code goes to /verify. */
export async function registerAction(
  _prev: RegisterResultState | null,
  formData: FormData,
): Promise<RegisterResultState> {
  const result = await auth.register(formData);
  if (result.status === 'verification_sent') redirect('/verify');
  return result;
}

export async function verifyCodeAction(
  _prev: VerifyResultState | null,
  formData: FormData,
): Promise<VerifyResultState> {
  const result = await auth.verifyOtp(formData);
  if (result.status === 'ok') redirect(result.next);
  if (result.status === 'mfa_required' || result.status === 'mfa_setup_required') {
    redirect('/login/2fa');
  }
  return result;
}

/**
 * A new sign-up code after the 15-minute /verify window closed. Seller codes always go to the
 * email (the API picks email first), so the channel and purpose are fixed here, not by the form.
 * The API answers the same whether or not the address needs a code (no account enumeration).
 */
export async function sendVerifyCodeAction(
  _prev: CodeSentState | null,
  formData: FormData,
): Promise<CodeSentState> {
  const result = await auth.sendOtp({
    target: formData.get('target'),
    channel: 'email',
    purpose: 'verify',
  });
  if (result.status === 'sent') redirect('/verify');
  return result;
}

export async function resendCodeAction(_prev: CodeSentState | null): Promise<CodeSentState> {
  return auth.resendCode();
}

export async function forgotPasswordAction(
  _prev: CodeSentState | null,
  formData: FormData,
): Promise<CodeSentState> {
  const result = await auth.forgotPassword(formData);
  if (result.status === 'sent') redirect('/reset-password');
  return result;
}

export async function resetPasswordAction(
  _prev: DoneState | null,
  formData: FormData,
): Promise<DoneState> {
  const result = await auth.resetPassword(formData);
  if (result.status === 'ok') redirect('/login?notice=password-reset');
  return result;
}

'use server';

import { safeNextPath, type AuthError, type LoginResultState } from '@hb/auth';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { adminError } from '@/lib/auth-copy';

// Server actions for the admin sign-in (docs/b2-auth.md §7): password → 2FA code, or first-time
// 2FA enrolment. Next.js rejects cross-origin action posts (our CSRF guard, with SameSite=Strict
// cookies). redirect() stays outside try/catch: it works by throwing.

export async function loginAction(
  _prev: LoginResultState | null,
  formData: FormData,
): Promise<LoginResultState> {
  const result = await auth.login(formData);
  if (result.status === 'ok') redirect(result.next);
  if (result.status === 'mfa_required') redirect('/login/2fa');
  if (result.status === 'mfa_setup_required') redirect('/login/2fa/setup');
  return adminError(result, 'login');
}

export async function twoFactorAction(
  _prev: LoginResultState | null,
  formData: FormData,
): Promise<LoginResultState> {
  const result = await auth.challenge2fa(formData);
  if (result.status === 'ok') redirect(result.next);
  if (result.status !== 'error') redirect('/login/2fa');
  return adminError(result, 'challenge');
}

export type SetupState =
  | { step: 'failed'; error: AuthError }
  | { step: 'scan'; secret: string; qrDataUrl: string; error?: AuthError }
  /** 2FA is on and the session is set; `unsaved` = "I saved these codes" was not ticked. */
  | { step: 'codes'; backupCodes: string[]; next: string; unsaved?: boolean }
  | null;

const QR_PREFIX = 'data:image/svg+xml;base64,';
const SECRET = /^[A-Z2-7]{16,256}=*$/i;
const BACKUP_CODE = /^[0-9A-Z]{5}-?[0-9A-Z]{5}$/i;

// The previous state comes back from the browser, so only what still looks like ours is echoed.
function scanFrom(prev: SetupState) {
  if (prev?.step !== 'scan') return null;
  const { secret, qrDataUrl } = prev;
  if (typeof secret !== 'string' || !SECRET.test(secret)) return null;
  if (typeof qrDataUrl !== 'string' || !qrDataUrl.startsWith(QR_PREFIX)) return null;
  if (qrDataUrl.length > 64_000) return null;
  return { secret, qrDataUrl };
}

function codesFrom(prev: SetupState) {
  if (prev?.step !== 'codes' || !Array.isArray(prev.backupCodes)) return null;
  const codes = prev.backupCodes;
  if (codes.length !== 10 || !codes.every((c) => typeof c === 'string' && BACKUP_CODE.test(c))) {
    return null;
  }
  return { backupCodes: codes, next: safeNextPath(prev.next, '/') };
}

/**
 * The whole first-time enrolment as one state machine (it also works without JavaScript):
 * start → QR code + key → first code → backup codes (shown once) → "I saved these codes" → next.
 * No secret is created while rendering the page: only the "start" step asks the API for one.
 */
export async function twoFactorSetupAction(
  prev: SetupState,
  formData: FormData,
): Promise<SetupState> {
  const intent = formData.get('intent');
  if (intent === 'start') {
    const result = await auth.setup2fa();
    if (result.status === 'error') return { step: 'failed', error: adminError(result, 'setup') };
    return { step: 'scan', secret: result.secret, qrDataUrl: result.qrDataUrl };
  }
  if (intent === 'enable') {
    const scan = scanFrom(prev);
    if (!scan) return null;
    const result = await auth.enable2fa(formData);
    if (result.status === 'error') {
      return { step: 'scan', ...scan, error: adminError(result, 'enable') };
    }
    // result.user (the profile) is not needed in the browser.
    return { step: 'codes', backupCodes: result.backupCodes, next: result.next ?? '/' };
  }
  if (intent === 'finish') {
    const codes = codesFrom(prev);
    if (formData.get('saved') === 'yes') redirect(codes?.next ?? '/');
    return codes ? { step: 'codes', ...codes, unsaved: true } : null;
  }
  return null;
}

'use server';

import {
  ApiRequestError,
  friendlyMessage,
  type AuthError,
  type AuthResultCode,
  type DoneState,
  type FieldErrors,
  type FormValues,
} from '@hb/auth';
import { StartSellerApplicationRequest, TokenPair } from '@hb/types';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { storeTokens } from '@/lib/session-tokens';
import { MESSAGES } from '@/lib/validation';

// Seller portal actions. Every call is authenticated with the session cookies (Bearer to the
// API); the user and seller ids always come from the token, never from the form.

// ---------- start an application ----------

export type ApplicationState = AuthError | null;

/** API/zod field → form field ("type" is the "sellerType" radio group in the form). */
const FORM_FIELD: Record<string, string> = { type: 'sellerType', storeName: 'storeName' };
const FIELD_MESSAGE: Record<string, string> = {
  sellerType: MESSAGES.sellerType,
  storeName: MESSAGES.storeName,
};

function text(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

function applicationError(
  code: AuthResultCode,
  values: FormValues,
  paths: string[] = [],
  details: ApiRequestError['details'] = {},
): AuthError {
  const fieldErrors: FieldErrors = {};
  for (const path of paths) {
    const field = FORM_FIELD[path.split('.')[0] ?? ''];
    if (field) fieldErrors[field] = FIELD_MESSAGE[field] ?? 'Check this field and try again.';
  }
  const error: AuthError = { status: 'error', code, message: friendlyMessage(code, details) };
  if (Object.keys(fieldErrors).length) error.fieldErrors = fieldErrors;
  if (Object.keys(values).length) error.values = values;
  if (details.retryAfterSec) error.retryAfterSec = details.retryAfterSec;
  return error;
}

/**
 * "Start your application" for signed-in users without a store: POST /seller/application makes
 * a draft seller and rotates the session so the new tokens carry the seller context (b2-auth §3).
 */
export async function startApplicationAction(
  _prev: ApplicationState,
  formData: FormData,
): Promise<ApplicationState> {
  const input = {
    type: text(formData.get('sellerType')),
    storeName: text(formData.get('storeName')),
  };
  const values: FormValues = {};
  if (input.type) values.sellerType = input.type.slice(0, 32);
  if (input.storeName) values.storeName = input.storeName.slice(0, 254);

  const parsed = StartSellerApplicationRequest.safeParse(input);
  if (!parsed.success) {
    return applicationError(
      'VALIDATION_FAILED',
      values,
      parsed.error.issues.map((i) => i.path.map(String).join('.')),
    );
  }

  let tokens: TokenPair | null = null;
  let outcome: 'stored' | 'exists' | 'signed_out' = 'stored';
  try {
    tokens = await auth.apiFetch('/seller/application', TokenPair, {
      method: 'POST',
      body: parsed.data,
    });
  } catch (error) {
    if (!(error instanceof ApiRequestError)) throw error;
    if (error.code === 'CONFLICT') outcome = 'exists';
    else if (error.status === 401) outcome = 'signed_out';
    else {
      return applicationError(
        error.code as AuthResultCode,
        values,
        error.details.issues?.map((i) => i.path),
        error.details,
      );
    }
  }
  if (tokens) await storeTokens(tokens);
  // "exists": another tab already started it; the dashboard shows its status.
  if (outcome === 'signed_out') redirect('/login?next=%2Fdashboard');
  redirect('/dashboard');
}

// ---------- two-factor ----------

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
      revalidatePath('/security');
      return { step: 'codes', backupCodes: result.backupCodes };
    }
    return { step: 'scan', secret: prev.secret, qrDataUrl: prev.qrDataUrl, error: result };
  }
  return null; // "I saved these codes" / "Cancel setup"
}

export async function disableTwoFactorAction(
  _prev: DoneState | null,
  formData: FormData,
): Promise<DoneState> {
  const result = await auth.disable2fa(formData);
  if (result.status === 'ok') revalidatePath('/security');
  return result;
}

// ---------- sessions ----------

export async function revokeSessionAction(
  _prev: DoneState | null,
  formData: FormData,
): Promise<DoneState> {
  const result = await auth.revokeSession(formData);
  if (result.status === 'ok') revalidatePath('/security');
  return result;
}

export async function logoutAction(): Promise<void> {
  await auth.logout();
  redirect('/login?notice=signed-out');
}

export async function logoutAllAction(_prev: DoneState | null): Promise<DoneState> {
  const result = await auth.logoutAll();
  if (result.status === 'ok') redirect('/login?notice=signed-out-everywhere');
  return result;
}

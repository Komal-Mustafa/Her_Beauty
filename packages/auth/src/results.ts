// Small discriminated results the apps render (docs/b2-auth.md §7). Every helper returns
// `{ status: 'error', ... }` on failure, so one form component can render any of them.
import type { Me, OtpChannel } from '@hb/types';
import {
  ApiRequestError,
  friendlyMessage,
  type ApiErrorDetails,
  type ApiIssue,
  type AuthResultCode,
} from './errors';

/** Field name → message, for `aria-invalid` + inline errors. */
export type FieldErrors = Record<string, string>;
/** Non-secret values echoed back so a form keeps what was typed (never passwords or codes). */
export type FormValues = Record<string, string>;

export type AuthError = {
  status: 'error';
  code: AuthResultCode;
  /** Friendly, safe to render as is. */
  message: string;
  fieldErrors?: FieldErrors;
  values?: FormValues;
  /** Seconds before another try can work (rate limits, resend cooldown). */
  retryAfterSec?: number;
  /** The API wants a CAPTCHA token on the next try (set per IP, never per account). */
  captchaRequired?: boolean;
};

/** Where a login landed. `next` is always a safe same-origin path. */
export type LoginOutcome =
  | { status: 'ok'; user: Me; next: string }
  | { status: 'mfa_required'; next: string }
  | { status: 'mfa_setup_required'; next: string };

export type LoginResultState = LoginOutcome | AuthError;
export type RegisterResultState =
  | { status: 'verification_sent'; channel: OtpChannel; target: string }
  | AuthError;
export type CodeSentState =
  | { status: 'sent'; channel: OtpChannel; target: string; expiresInSec: number }
  | AuthError;
export type VerifyResultState = LoginOutcome | { status: 'profile_required' } | AuthError;
export type TwoFactorSetupState =
  | { status: 'ok'; secret: string; otpauthUri: string; qrDataUrl: string }
  | AuthError;
export type TwoFactorEnableState =
  | { status: 'ok'; backupCodes: string[]; user?: Me; next?: string }
  | AuthError;
export type ProfileState = { status: 'ok'; user: Me } | AuthError;
export type DoneState = { status: 'ok' } | AuthError;

/**
 * The account/security "two-factor" panel, one server action for the whole enrolment:
 * setup → scan + first code → backup codes (shown once) → done (null).
 */
export type TwoFactorPanelState =
  | { step: 'scan'; secret: string; qrDataUrl: string; error?: AuthError }
  | { step: 'codes'; backupCodes: string[] }
  | { step: 'failed'; error: AuthError }
  | null;

/** Per-helper copy for field errors (zod messages are not user-facing). */
export type FieldMessages = Record<string, string>;

export type ErrorContext = {
  values?: FormValues;
  fields?: FieldMessages;
  /** Field that shows INVALID_CODE inline (e.g. "code"). */
  codeField?: string;
  /** Field that shows WEAK_PASSWORD inline (e.g. "password" / "newPassword"). */
  passwordField?: string;
  /** Replace the default copy for specific codes. */
  messages?: Partial<Record<string, string>>;
};

export function isAuthError(value: unknown): value is AuthError {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { status?: unknown }).status === 'error'
  );
}

function fieldErrorsFromIssues(issues: ApiIssue[], fields: FieldMessages = {}): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path.split('.')[0] ?? '';
    if (!key || out[key]) continue;
    out[key] = fields[key] ?? 'Check this field and try again.';
  }
  return out;
}

export function makeError(
  code: AuthResultCode,
  ctx: ErrorContext = {},
  details: ApiErrorDetails = {},
): AuthError {
  const message = ctx.messages?.[code] ?? friendlyMessage(code, details);
  const error: AuthError = { status: 'error', code, message };
  let fieldErrors: FieldErrors = {};
  if (details.issues?.length) fieldErrors = fieldErrorsFromIssues(details.issues, ctx.fields);
  if (code === 'INVALID_CODE' && ctx.codeField) fieldErrors[ctx.codeField] = message;
  if (code === 'WEAK_PASSWORD' && ctx.passwordField) fieldErrors[ctx.passwordField] = message;
  if (Object.keys(fieldErrors).length) error.fieldErrors = fieldErrors;
  if (ctx.values && Object.keys(ctx.values).length) error.values = ctx.values;
  if (details.retryAfterSec) error.retryAfterSec = details.retryAfterSec;
  if (details.captchaRequired) error.captchaRequired = true;
  return error;
}

/** Local validation failure (before any API call). */
export function invalid(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey> }>,
  ctx: ErrorContext = {},
): AuthError {
  return makeError('VALIDATION_FAILED', ctx, {
    issues: issues.map((i) => ({ path: i.path.map(String).join('.'), message: '' })),
  });
}

/**
 * Turns an ApiRequestError into an AuthError. Anything else (a bug, Next's redirect signal) is
 * re-thrown: failures we did not expect must not be disguised as form errors.
 */
export function toAuthError(error: unknown, ctx: ErrorContext = {}): AuthError {
  if (!(error instanceof ApiRequestError)) throw error;
  const code = error.code as AuthResultCode;
  return makeError(code, ctx, error.details);
}

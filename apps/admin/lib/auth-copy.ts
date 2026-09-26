import { SECOND_FACTOR_CODE_MESSAGES, type AuthError } from '@hb/auth/client';
import { MESSAGES } from './validation';

// Admin wording on top of @hb/auth's shared copy: admins log in with a work email (no mobile
// number, no self-service reset) and their codes always come from an authenticator app.
// Messages stay non-blaming and never say which part of a login was wrong (security.md §4).

type Step = 'login' | 'challenge' | 'setup' | 'enable';

export const TIMED_OUT = 'Your sign-in timed out. Log in again and we’ll ask for a fresh code.';

const SIGNED_OUT_CODES = new Set(['UNAUTHENTICATED', 'SESSION_REVOKED', 'INVALID_CREDENTIALS']);

function withMessage(error: AuthError, message: string, field?: string): AuthError {
  const fieldErrors = field ? { ...error.fieldErrors, [field]: message } : error.fieldErrors;
  return fieldErrors ? { ...error, message, fieldErrors } : { ...error, message };
}

export function adminError(error: AuthError, step: Step): AuthError {
  if (step === 'login') {
    let out = error;
    if (error.code === 'INVALID_CREDENTIALS') {
      out = withMessage(
        error,
        error.captchaRequired
          ? 'We couldn’t log you in with those details. Complete the security check, then try again.'
          : 'We couldn’t log you in with those details. Check your work email and password, then try again.',
      );
    }
    if (out.fieldErrors?.identifier) {
      out = { ...out, fieldErrors: { ...out.fieldErrors, identifier: MESSAGES.workEmail } };
    }
    return out;
  }
  if (step !== 'setup' && error.code === 'INVALID_CODE') {
    return withMessage(error, SECOND_FACTOR_CODE_MESSAGES[step], 'code');
  }
  if (step !== 'challenge' && SIGNED_OUT_CODES.has(error.code)) {
    return withMessage(error, TIMED_OUT);
  }
  if (step === 'setup' && error.code === 'CONFLICT') {
    return withMessage(
      error,
      'Two-step verification is already on for this account. Log in again and enter a code from your authenticator app.',
    );
  }
  return error;
}

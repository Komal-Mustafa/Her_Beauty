// Typed API errors and the friendly copy the apps render. Edge-safe.
import type { AuthErrorCode } from '@hb/types';

/** Codes produced by @hb/auth itself (not by the API). */
export type LocalErrorCode =
  | 'NETWORK'
  | 'INTERNAL'
  | 'BAD_RESPONSE'
  | 'PENDING_EXPIRED'
  | 'MFA_EXPIRED'
  | 'RESEND_TOO_SOON';

export type AuthResultCode = AuthErrorCode | LocalErrorCode | 'NOT_FOUND' | 'HTTP_ERROR';

export type ApiIssue = { path: string; message: string };

export type ApiErrorDetails = {
  retryAfterSec?: number;
  captchaRequired?: boolean;
  issues?: ApiIssue[];
};

/** Any non-2xx answer (or no answer) from the API. `code` is the API's `error.code`. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorDetails;

  constructor(status: number, code: string, message: string, details: ApiErrorDetails = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const CODE_BY_STATUS: Record<number, string> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'PROFILE_REQUIRED',
  429: 'RATE_LIMITED',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readDetails(raw: unknown, retryAfterHeader: string | null): ApiErrorDetails {
  const details: ApiErrorDetails = {};
  const d = isRecord(raw) ? raw : {};
  const retry = typeof d.retryAfterSec === 'number' ? d.retryAfterSec : Number(retryAfterHeader);
  if (Number.isFinite(retry) && retry > 0) details.retryAfterSec = Math.ceil(retry);
  if (d.captchaRequired === true) details.captchaRequired = true;
  if (Array.isArray(d.issues)) {
    details.issues = d.issues
      .filter(isRecord)
      .map((i) => ({ path: String(i.path ?? ''), message: String(i.message ?? '') }));
  }
  return details;
}

/** Builds an ApiRequestError from the API error body `{ error: { code, message, details } }`. */
export async function errorFromResponse(res: Response): Promise<ApiRequestError> {
  const body: unknown = await res.json().catch(() => null);
  const error = isRecord(body) && isRecord(body.error) ? body.error : {};
  const code =
    typeof error.code === 'string' && error.code
      ? error.code
      : res.status >= 500
        ? 'INTERNAL'
        : (CODE_BY_STATUS[res.status] ?? 'HTTP_ERROR');
  const message =
    typeof error.message === 'string' ? error.message : `Request failed: ${res.status}`;
  return new ApiRequestError(
    res.status,
    code,
    message,
    readDetails(error.details, res.headers.get('retry-after')),
  );
}

function waitText(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

/**
 * Copy for each error: never blames the person, always says how to recover (04-ui-ux, errors).
 * INVALID_CREDENTIALS deliberately does not say which part was wrong (security.md §4).
 */
export function friendlyMessage(code: string, details: ApiErrorDetails = {}): string {
  switch (code) {
    case 'INVALID_CREDENTIALS':
      return details.captchaRequired
        ? 'We couldn’t log you in with those details. Complete the security check, then try again — or reset your password.'
        : 'We couldn’t log you in with those details. Check your email or mobile number and password, or reset your password.';
    case 'INVALID_CODE':
      return 'That code didn’t work. It may have expired or already been used — check the latest message or ask for a new code.';
    case 'WEAK_PASSWORD':
      return 'That password is too easy to guess. Try a longer one, like a short phrase only you would know.';
    case 'PROFILE_REQUIRED':
      return 'Add your name to finish creating your account.';
    case 'RATE_LIMITED':
      return details.retryAfterSec
        ? `Too many tries for now. Please wait ${waitText(details.retryAfterSec)}, then try again.`
        : 'Too many tries for now. Please wait a few minutes, then try again.';
    case 'UNAUTHENTICATED':
    case 'SESSION_REVOKED':
      return 'Your session has ended. Log in again to continue.';
    case 'FORBIDDEN':
      return 'This isn’t available for your account. If you think it should be, contact support.';
    case 'MFA_REQUIRED':
      return 'Confirm it’s you with your authenticator app to continue.';
    case 'CONFLICT':
      return 'This is already set up. Refresh the page to see the latest details.';
    case 'VALIDATION_FAILED':
      return 'A few details need another look. Check the highlighted fields and try again.';
    case 'NOT_FOUND':
      return 'We couldn’t find that. Refresh the page and try again.';
    case 'PENDING_EXPIRED':
      return 'Your code request has timed out. Start again and we’ll send a new code.';
    case 'MFA_EXPIRED':
      return 'Your sign-in timed out. Log in again and we’ll ask for a fresh code.';
    case 'RESEND_TOO_SOON':
      return details.retryAfterSec
        ? `You can ask for a new code in ${waitText(details.retryAfterSec)}.`
        : 'You can ask for a new code in a moment.';
    case 'NETWORK':
      return 'We couldn’t reach Her Beauty just now. Check your connection and try again in a moment.';
    default:
      return 'Something went wrong on our side. Please try again in a moment.';
  }
}

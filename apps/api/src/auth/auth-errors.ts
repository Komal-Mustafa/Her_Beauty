import { HttpStatus } from '@nestjs/common';
import type { AuthErrorCode } from '@hb/types';
import { ApiError } from '../common/errors';

// docs/b2-auth.md §4 error codes. Messages never say which part of a credential was wrong.

const err = (status: HttpStatus, code: AuthErrorCode, message: string, details: object = {}) =>
  new ApiError(status, code, message, details);

/** Unknown account, wrong password, locked account and wrong audience all look the same. */
export const invalidCredentials = (captchaRequired = false) =>
  err(
    HttpStatus.UNAUTHORIZED,
    'INVALID_CREDENTIALS',
    'Those sign-in details did not match an account.',
    captchaRequired ? { captchaRequired: true } : {},
  );

export const invalidCode = () =>
  err(
    HttpStatus.BAD_REQUEST,
    'INVALID_CODE',
    'That code is not valid any more. Request a new one.',
  );

export const weakPassword = (reason: string) =>
  err(HttpStatus.BAD_REQUEST, 'WEAK_PASSWORD', reason);

export const profileRequired = () =>
  err(HttpStatus.UNPROCESSABLE_ENTITY, 'PROFILE_REQUIRED', 'Tell us your name to finish.');

export const rateLimited = (retryAfterSec: number) =>
  err(HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMITED', 'Too many attempts. Try again later.', {
    retryAfterSec,
  });

export const unauthenticated = (message = 'Please sign in to continue.') =>
  err(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', message);

export const sessionRevoked = () =>
  err(HttpStatus.UNAUTHORIZED, 'SESSION_REVOKED', 'This session has ended. Please sign in again.');

export const forbidden = (message = 'You do not have access to this.') =>
  err(HttpStatus.FORBIDDEN, 'FORBIDDEN', message);

export const mfaRequired = () =>
  err(HttpStatus.FORBIDDEN, 'MFA_REQUIRED', 'Two-factor authentication is required.');

export const conflict = (message: string) => err(HttpStatus.CONFLICT, 'CONFLICT', message);

export const validationFailed = (path: string, message: string) =>
  err(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Some fields are invalid.', {
    issues: [{ path, message }],
  });

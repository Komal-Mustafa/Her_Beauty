import { otpCodeCheck, secondFactorCheck } from '@hb/auth/client';
import { Email } from '@hb/types';
import { fieldRule, type FieldCheck } from '@hb/ui';

// Client-side checks for blur-first validation (rules.md §7: zod on the client for UX; the API
// is the source of truth). Admins log in with a work email, and their codes always come from an
// authenticator app, so the console keeps its own wording on top of the shared checks.

export const MESSAGES = {
  workEmail: 'Enter your work email, like name@company.com.',
  password: 'Enter your password.',
  code: 'Enter the 6-digit code from your authenticator app.',
  backupCode: 'Enter a backup code, like ABCDE-12345.',
} as const;

export const checks = {
  workEmail: fieldRule(Email, MESSAGES.workEmail),
  password: (value: string) => (value ? undefined : MESSAGES.password),
  code: otpCodeCheck(MESSAGES.code),
  backupCode: secondFactorCheck(MESSAGES.backupCode),
} satisfies Record<string, FieldCheck>;

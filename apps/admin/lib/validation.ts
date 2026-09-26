import { Email, OtpCode, SecondFactorCode } from '@hb/types';

// Client-side checks for blur-first validation (rules.md §7: zod on the client for UX; the API
// is the source of truth).

export type Check = (value: string, form: HTMLFormElement | null) => string | undefined;

type SafeParser = { safeParse(value: unknown): { success: boolean } };

const rule =
  (schema: SafeParser, message: string): Check =>
  (value) =>
    schema.safeParse(value).success ? undefined : message;

export const MESSAGES = {
  workEmail: 'Enter your work email, like name@company.com.',
  password: 'Enter your password.',
  code: 'Enter the 6-digit code from your authenticator app.',
  backupCode: 'Enter a backup code, like ABCDE-12345.',
} as const;

export const checks = {
  workEmail: rule(Email, MESSAGES.workEmail),
  password: (value: string) => (value ? undefined : MESSAGES.password),
  code: (value: string) =>
    OtpCode.safeParse(value.replace(/\s+/g, '')).success ? undefined : MESSAGES.code,
  backupCode: rule(SecondFactorCode, MESSAGES.backupCode),
} satisfies Record<string, Check>;

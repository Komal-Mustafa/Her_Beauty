import {
  Email,
  FullName,
  Identifier,
  OtpCode,
  Password,
  PhoneInput,
  SecondFactorCode,
} from '@hb/types';

// Client-side checks for blur-first validation (rules.md §7: zod on the client for UX; the API
// is the source of truth). Copy matches @hb/auth's server-side field messages.

export type Check = (value: string, form: HTMLFormElement | null) => string | undefined;

type SafeParser = { safeParse(value: unknown): { success: boolean } };

const rule =
  (schema: SafeParser, message: string): Check =>
  (value) =>
    schema.safeParse(value).success ? undefined : message;

const optional =
  (check: Check): Check =>
  (value, form) =>
    value.trim() === '' ? undefined : check(value, form);

export const MESSAGES = {
  identifier: 'Enter the email or mobile number you signed up with.',
  password: 'Enter your password.',
  newPassword: 'Use 8 to 128 characters.',
  fullName: 'Enter your name, at least 2 letters.',
  email: 'Enter an email like name@example.com.',
  phone: 'Enter a mobile number like 0300 1234567.',
  code: 'Enter the 6-digit code.',
  secondFactor: 'Enter the 6-digit code from your app, or a backup code.',
  emailOrPhone: 'Add an email or a mobile number so we can send your code.',
} as const;

export const checks = {
  identifier: rule(Identifier, MESSAGES.identifier),
  password: (value: string) => (value ? undefined : MESSAGES.password),
  newPassword: rule(Password, MESSAGES.newPassword),
  fullName: rule(FullName, MESSAGES.fullName),
  email: optional(rule(Email, MESSAGES.email)),
  phone: optional(rule(PhoneInput, MESSAGES.phone)),
  mobile: rule(PhoneInput, MESSAGES.phone),
  code: (value: string) =>
    OtpCode.safeParse(value.replace(/\s+/g, '')).success ? undefined : MESSAGES.code,
  secondFactor: rule(SecondFactorCode, MESSAGES.secondFactor),
} satisfies Record<string, Check>;

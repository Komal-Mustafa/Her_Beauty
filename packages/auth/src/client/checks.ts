// Blur-first checks for the auth forms. The copy is the same the server helpers use for their
// field errors (../copy.ts), so a message never changes between client and server.
import {
  Email,
  FullName,
  Identifier,
  OtpCode,
  Password,
  PhoneInput,
  SecondFactorCode,
} from '@hb/types';
import { fieldRule, type FieldCheck } from '@hb/ui';
import { FIELD_MESSAGES } from '../copy';

/** A 6-digit code (spaces allowed while typing). */
export function otpCodeCheck(message: string = FIELD_MESSAGES.code): FieldCheck {
  return (value) => (OtpCode.safeParse(value.replace(/\s+/g, '')).success ? undefined : message);
}

/** An authenticator-app code or a backup code (XXXXX-XXXXX). */
export function secondFactorCheck(message: string = FIELD_MESSAGES.secondFactor): FieldCheck {
  return fieldRule(SecondFactorCode, message);
}

export const authChecks = {
  identifier: fieldRule(Identifier, FIELD_MESSAGES.identifier),
  password: (value: string) => (value ? undefined : FIELD_MESSAGES.password),
  newPassword: fieldRule(Password, FIELD_MESSAGES.newPassword),
  fullName: fieldRule(FullName, FIELD_MESSAGES.fullName),
  email: fieldRule(Email, FIELD_MESSAGES.email),
  phone: fieldRule(PhoneInput, FIELD_MESSAGES.phone),
  code: otpCodeCheck(),
  secondFactor: secondFactorCheck(),
} satisfies Record<string, FieldCheck>;

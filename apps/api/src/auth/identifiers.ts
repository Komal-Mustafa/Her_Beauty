import { z } from 'zod';
import type { OtpChannel } from '@hb/types';
import { validationFailed } from './auth-errors';

// docs/b2-auth.md §4: emails trimmed + lower-cased; mobile numbers normalised to E.164 with
// Pakistan as the default country. Anything else is VALIDATION_FAILED.

export type Identifier = { kind: 'email'; value: string } | { kind: 'phone'; value: string };

const EmailShape = z.email().max(254);

export function normaliseEmail(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  return EmailShape.safeParse(value).success ? value : null;
}

/**
 * Pakistani mobile numbers (3XX XXXXXXX) in any common spelling: 03001234567, 3001234567,
 * +923001234567, 923001234567, 00923001234567, with spaces or dashes. Returns +923001234567.
 */
export function normalisePhone(raw: string): string | null {
  const compact = raw.trim().replace(/[\s-]/g, '');
  const match = /^(?:\+92|0092|92|0)?(3[0-9]{9})$/.exec(compact);
  return match ? `+92${match[1]}` : null;
}

export function parseIdentifier(raw: string, path = 'identifier'): Identifier {
  if (raw.includes('@')) {
    const email = normaliseEmail(raw);
    if (email) return { kind: 'email', value: email };
    throw validationFailed(path, 'Enter a valid email address');
  }
  const phone = normalisePhone(raw);
  if (phone) return { kind: 'phone', value: phone };
  throw validationFailed(path, 'Enter an email address or a mobile number like 0300 1234567');
}

/** OTP targets must match their channel: email for "email", mobile number for "sms". */
export function parseTarget(channel: OtpChannel, raw: string, path = 'target'): Identifier {
  const id = parseIdentifier(raw, path);
  if ((channel === 'email') !== (id.kind === 'email')) {
    throw validationFailed(
      path,
      channel === 'email' ? 'Enter an email address' : 'Enter a mobile number',
    );
  }
  return id;
}

export const channelOf = (id: Identifier): OtpChannel => (id.kind === 'email' ? 'email' : 'sms');

/** "a•••@gmail.com" / "+92 300 •••• 567" — safe to show back and to log. */
export function maskIdentifier(id: Identifier): string {
  if (id.kind === 'email') {
    const at = id.value.lastIndexOf('@');
    return `${id.value.slice(0, 1)}•••${id.value.slice(at)}`;
  }
  const national = id.value.slice(3);
  return `+92 ${national.slice(0, 3)} •••• ${national.slice(-3)}`;
}

export const identifierWhere = (id: Identifier) =>
  id.kind === 'email' ? { email: id.value } : { phone: id.value };

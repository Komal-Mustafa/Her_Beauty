import { authChecks, FIELD_MESSAGES } from '@hb/auth/client';
import { optionalField } from '@hb/ui';

// Client-side checks for blur-first validation (rules.md §7: zod on the client for UX; the API
// is the source of truth). The shared auth checks carry the same copy as @hb/auth's server-side
// field messages; the shop only adds its own variants.

export const MESSAGES = FIELD_MESSAGES;

export const checks = {
  ...authChecks,
  // Sign-up takes an email, a mobile number, or both (the pair is checked on submit).
  email: optionalField(authChecks.email),
  phone: optionalField(authChecks.phone),
  mobile: authChecks.phone,
};

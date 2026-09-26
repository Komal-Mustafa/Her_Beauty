import { authChecks, FIELD_MESSAGES } from '@hb/auth/client';
import { SellerType, StoreName } from '@hb/types';
import { fieldRule } from '@hb/ui';

// Client-side checks for blur-first validation (rules.md §7: zod on the client for UX; the API
// is the source of truth). The shared auth checks carry the same copy as @hb/auth's server-side
// field messages; the seller portal adds its store fields.

export const MESSAGES = FIELD_MESSAGES;

export const checks = {
  ...authChecks,
  mobile: authChecks.phone,
  storeName: fieldRule(StoreName, MESSAGES.storeName),
};

/** Radio groups are not single elements, so their check runs on submit (formCheck). */
export function checkSellerType(form: HTMLFormElement): Record<string, string> {
  const field = form.elements.namedItem('sellerType');
  const value = field instanceof RadioNodeList ? field.value : '';
  return SellerType.safeParse(value).success ? {} : { sellerType: MESSAGES.sellerType };
}

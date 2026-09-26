// Server-compatible (no hooks).
import type { OtpChannel } from '@hb/types';
import { Badge } from '@hb/ui';
import type { CodeSentState } from '../results';
import type { FormAction } from './types';
import { VerifyContactButton } from './verify-contact-button';

/**
 * An email or mobile number on the account with its verified state, and "Verify" while it is not
 * confirmed. `verifyAction` sends the code (purpose "verify") and opens /verify.
 */
export function ContactRow({
  label,
  value,
  verified,
  channel,
  verifyAction,
  hint,
}: {
  label: string;
  value: string | null;
  verified: boolean;
  channel: OtpChannel;
  verifyAction: FormAction<CodeSentState>;
  /** Shown under an unverified value, e.g. what confirming it unlocks. */
  hint?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="min-w-0">
        <p className="text-sm text-ink-500">{label}</p>
        <p className="font-medium text-ink-900 wrap-anywhere">{value ?? 'Not added'}</p>
        {value && (
          <Badge kind={verified ? 'success' : 'warning'} className="mt-1">
            {verified ? 'Verified' : 'Not verified'}
          </Badge>
        )}
        {value && !verified && hint && <p className="mt-1 text-sm text-ink-500">{hint}</p>}
      </div>
      {value && !verified && (
        <VerifyContactButton
          channel={channel}
          label={`Verify ${label.toLowerCase()}`}
          action={verifyAction}
        />
      )}
    </div>
  );
}

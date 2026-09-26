'use client';

import type { CodeSentState } from '@hb/auth';
import { SubmitButton } from '@hb/ui';
import { useActionState } from 'react';
import { sendVerificationAction } from '@/app/(shop)/account/actions';

/** Sends a confirmation code to the account's own email or mobile number, then opens /verify. */
export function VerifyContactButton({
  channel,
  target,
  label,
}: {
  channel: 'sms' | 'email';
  target: string;
  label: string;
}) {
  const [state, action] = useActionState<CodeSentState | null, FormData>(
    sendVerificationAction,
    null,
  );
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="channel" value={channel} />
      <input type="hidden" name="target" value={target} />
      <input type="hidden" name="purpose" value="verify" />
      <input type="hidden" name="next" value="/account" />
      <SubmitButton variant="secondary" size="sm" pendingLabel="Sending…" aria-label={label}>
        Verify
      </SubmitButton>
      {state?.status === 'error' && (
        <p role="alert" className="max-w-xs text-right text-xs text-danger">
          {state.message}
        </p>
      )}
    </form>
  );
}

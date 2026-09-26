'use client';

import type { OtpChannel } from '@hb/types';
import { SubmitButton } from '@hb/ui';
import { useActionState } from 'react';
import type { CodeSentState } from '../results';
import type { FormAction } from './types';

/**
 * Sends a confirmation code to the account's own email or mobile number. Only the channel is
 * posted: the action takes the address from the session, never from the form.
 */
export function VerifyContactButton({
  channel,
  label,
  action: sendAction,
}: {
  channel: OtpChannel;
  label: string;
  action: FormAction<CodeSentState>;
}) {
  const [state, action] = useActionState<CodeSentState | null, FormData>(sendAction, null);
  return (
    <form action={action} className="flex shrink-0 flex-col items-end gap-1">
      <input type="hidden" name="channel" value={channel} />
      <SubmitButton
        variant="secondary"
        size="sm"
        className="min-h-11"
        pendingLabel="Sending…"
        aria-label={label}
      >
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

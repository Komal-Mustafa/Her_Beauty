'use client';

import { CodeInput, FormAlert, Input, SubmitButton, useFieldErrors } from '@hb/ui';
import { useActionState } from 'react';
import type { LoginResultState } from '../results';
import { otpCodeCheck, secondFactorCheck } from './checks';
import type { FormAction } from './types';

/**
 * The log-in step after the password: a code from the authenticator app, or (backup) one of the
 * 10 backup codes. `action` wraps `auth.challenge2fa()`. `messages` replaces the inline copy.
 */
export function TwoFactorForm({
  action: challengeAction,
  backup,
  submitLabel = 'Verify and log in',
  messages = {},
}: {
  action: FormAction<LoginResultState>;
  backup: boolean;
  submitLabel?: string;
  messages?: { code?: string; backupCode?: string };
}) {
  const [state, action] = useActionState<LoginResultState | null, FormData>(challengeAction, null);
  const error = state?.status === 'error' ? state : null;
  const v = useFieldErrors(
    { code: backup ? secondFactorCheck(messages.backupCode) : otpCodeCheck(messages.code) },
    error,
  );
  return (
    <form action={action} onSubmit={v.onSubmit} noValidate className="space-y-5">
      <FormAlert state={state} />
      {backup ? (
        <Input
          label="Backup code"
          name="code"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="XXXXX-XXXXX"
          hint="Each backup code works once."
          error={v.errorFor('code')}
          {...v.field}
        />
      ) : (
        <CodeInput
          label="6-digit code"
          name="code"
          autoFocus
          hint="The code changes every 30 seconds."
          error={v.errorFor('code')}
          {...v.field}
        />
      )}
      <SubmitButton block pendingLabel="Checking…">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}

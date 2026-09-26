'use client';

import type { LoginResultState } from '@hb/auth';
import { CodeInput, Input, SubmitButton } from '@hb/ui';
import { useActionState } from 'react';
import { twoFactorAction } from '@/app/login/actions';
import { checks } from '@/lib/validation';
import { FormAlert } from './form-alert';
import { useFieldErrors } from './use-field-errors';

/** Step 2 of the admin sign-in: a code from the authenticator app, or (backup) a backup code. */
export function TwoFactorForm({ backup }: { backup: boolean }) {
  const [state, action] = useActionState<LoginResultState | null, FormData>(twoFactorAction, null);
  const error = state?.status === 'error' ? state : null;
  const v = useFieldErrors({ code: backup ? checks.backupCode : checks.code }, error);
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
        Verify and continue
      </SubmitButton>
    </form>
  );
}

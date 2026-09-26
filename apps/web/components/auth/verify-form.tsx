'use client';

import type { VerifyResultState } from '@hb/auth/client';
import { Alert, CodeInput, FormAlert, Input, SubmitButton, useFieldErrors } from '@hb/ui';
import { useActionState } from 'react';
import { verifyCodeAction } from '@/app/(auth)/actions';
import { checks } from '@/lib/validation';

/**
 * Step 1: the 6-digit code. If the number/email has no account yet, the API answers
 * PROFILE_REQUIRED without using up the code (kept server-side), and step 2 asks for a name.
 */
export function VerifyForm({ needsName }: { needsName: boolean }) {
  const [state, action] = useActionState<VerifyResultState | null, FormData>(
    verifyCodeAction,
    null,
  );
  const error = state?.status === 'error' ? state : null;
  const askName = needsName || state?.status === 'profile_required';
  const v = useFieldErrors(askName ? { fullName: checks.fullName } : { code: checks.code }, error);

  if (askName) {
    return (
      <form action={action} onSubmit={v.onSubmit} noValidate className="space-y-5">
        <Alert tone="success" title="Code accepted">
          Welcome to Her Beauty! Tell us your name to finish creating your account.
        </Alert>
        <FormAlert state={state} />
        <Input
          label="Full name"
          name="fullName"
          autoComplete="name"
          autoFocus
          defaultValue={error?.values?.fullName}
          error={v.errorFor('fullName')}
          {...v.field}
        />
        <SubmitButton block pendingLabel="Creating account…">
          Create account
        </SubmitButton>
      </form>
    );
  }

  return (
    <form action={action} onSubmit={v.onSubmit} noValidate className="space-y-5">
      <FormAlert state={state} />
      <CodeInput
        label="6-digit code"
        name="code"
        autoFocus
        error={v.errorFor('code')}
        {...v.field}
      />
      <SubmitButton block pendingLabel="Checking code…">
        Verify and continue
      </SubmitButton>
    </form>
  );
}

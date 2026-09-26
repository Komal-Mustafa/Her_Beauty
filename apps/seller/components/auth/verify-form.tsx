'use client';

import type { CodeSentState, VerifyResultState } from '@hb/auth/client';
import { Alert, CodeInput, FormAlert, Input, SubmitButton, useFieldErrors } from '@hb/ui';
import Link from 'next/link';
import { useActionState } from 'react';
import { sendVerifyCodeAction, verifyCodeAction } from '@/app/(auth)/actions';
import { checks } from '@/lib/validation';

/**
 * The 6-digit code that confirms a new seller account, or a mobile number confirmed from Security.
 * A right code logs the seller in.
 */
export function VerifyForm() {
  const [state, action] = useActionState<VerifyResultState | null, FormData>(
    verifyCodeAction,
    null,
  );
  const error = state?.status === 'error' ? state : null;
  const v = useFieldErrors({ code: checks.code }, error);

  // Only phone/email log-ins on the shop can create an account from a code; a seller account
  // always exists before its code is sent, so this means the sign-up did not go through.
  if (state?.status === 'profile_required') {
    return (
      <div className="space-y-5">
        <Alert tone="info">
          We couldn’t find a seller account for this code. Register again and we’ll send a fresh
          one.
        </Alert>
        <Link
          href="/register"
          className="inline-flex min-h-11 items-center font-medium text-pink-600 hover:underline"
        >
          Go to seller registration
        </Link>
      </div>
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

/** After the code window closed: send a fresh sign-up code to the registered email. */
export function VerifyAgainForm() {
  const [state, action] = useActionState<CodeSentState | null, FormData>(
    sendVerifyCodeAction,
    null,
  );
  const error = state?.status === 'error' ? state : null;
  const v = useFieldErrors({ target: checks.email }, error);
  return (
    <form action={action} onSubmit={v.onSubmit} noValidate className="space-y-5">
      <FormAlert state={state} />
      <Input
        label="Email you registered with"
        name="target"
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        defaultValue={error?.values?.target}
        error={v.errorFor('target')}
        {...v.field}
      />
      <SubmitButton block pendingLabel="Sending code…">
        Send a new code
      </SubmitButton>
    </form>
  );
}

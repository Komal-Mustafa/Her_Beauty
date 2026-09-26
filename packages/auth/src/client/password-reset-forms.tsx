'use client';

import { CodeInput, FormAlert, Input, PasswordInput, SubmitButton, useFieldErrors } from '@hb/ui';
import { useActionState } from 'react';
import type { CodeSentState, DoneState } from '../results';
import { Captcha } from './captcha';
import { authChecks } from './checks';
import type { FormAction } from './types';

/** Step 1 of a reset: the email or mobile number. `action` wraps `auth.forgotPassword()`. */
export function ForgotPasswordForm({
  action: forgotAction,
}: {
  action: FormAction<CodeSentState>;
}) {
  const [state, action] = useActionState<CodeSentState | null, FormData>(forgotAction, null);
  const error = state?.status === 'error' ? state : null;
  const v = useFieldErrors({ identifier: authChecks.identifier }, error);
  return (
    <form action={action} onSubmit={v.onSubmit} noValidate className="space-y-5">
      <FormAlert state={state} />
      <Input
        label="Email or mobile number"
        name="identifier"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        defaultValue={error?.values?.identifier}
        error={v.errorFor('identifier')}
        {...v.field}
      />
      <Captcha show={Boolean(error?.captchaRequired)} />
      <SubmitButton block pendingLabel="Sending code…">
        Send reset code
      </SubmitButton>
    </form>
  );
}

/** Step 2: the code and a new password. `action` wraps `auth.resetPassword()`. */
export function ResetPasswordForm({ action: resetAction }: { action: FormAction<DoneState> }) {
  const [state, action] = useActionState<DoneState | null, FormData>(resetAction, null);
  const error = state?.status === 'error' ? state : null;
  const v = useFieldErrors({ code: authChecks.code, newPassword: authChecks.newPassword }, error);
  return (
    <form action={action} onSubmit={v.onSubmit} noValidate className="space-y-5">
      <FormAlert state={state} />
      <CodeInput label="6-digit code" name="code" error={v.errorFor('code')} {...v.field} />
      <PasswordInput
        label="New password"
        name="newPassword"
        autoComplete="new-password"
        hint="At least 8 characters. A short phrase is easy to remember and hard to guess."
        error={v.errorFor('newPassword')}
        {...v.field}
      />
      <SubmitButton block pendingLabel="Saving…">
        Save new password
      </SubmitButton>
    </form>
  );
}

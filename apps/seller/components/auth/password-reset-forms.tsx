'use client';

import type { CodeSentState, DoneState } from '@hb/auth';
import { CodeInput, Input, PasswordInput, SubmitButton } from '@hb/ui';
import { useActionState } from 'react';
import { forgotPasswordAction, resetPasswordAction } from '@/app/(auth)/actions';
import { checks } from '@/lib/validation';
import { Captcha } from './captcha';
import { FormAlert } from './form-alert';
import { useFieldErrors } from './use-field-errors';

export function ForgotPasswordForm() {
  const [state, action] = useActionState<CodeSentState | null, FormData>(
    forgotPasswordAction,
    null,
  );
  const error = state?.status === 'error' ? state : null;
  const v = useFieldErrors({ identifier: checks.identifier }, error);
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

export function ResetPasswordForm() {
  const [state, action] = useActionState<DoneState | null, FormData>(resetPasswordAction, null);
  const error = state?.status === 'error' ? state : null;
  const v = useFieldErrors({ code: checks.code, newPassword: checks.newPassword }, error);
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

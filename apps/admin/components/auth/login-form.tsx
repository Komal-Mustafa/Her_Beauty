'use client';

import type { LoginResultState } from '@hb/auth';
import { Input, PasswordInput, SubmitButton } from '@hb/ui';
import { useActionState } from 'react';
import { loginAction } from '@/app/login/actions';
import { checks } from '@/lib/validation';
import { Captcha } from './captcha';
import { FormAlert } from './form-alert';
import { useFieldErrors } from './use-field-errors';

/** Step 1 of the admin sign-in: work email + password. The API then always asks for 2FA. */
export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<LoginResultState | null, FormData>(loginAction, null);
  const error = state?.status === 'error' ? state : null;
  const v = useFieldErrors({ identifier: checks.workEmail, password: checks.password }, error);
  return (
    <form action={action} onSubmit={v.onSubmit} noValidate className="space-y-5">
      <FormAlert state={state} />
      <input type="hidden" name="next" value={next} />
      <Input
        label="Work email"
        name="identifier"
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        defaultValue={error?.values?.identifier}
        error={v.errorFor('identifier')}
        {...v.field}
      />
      <PasswordInput
        label="Password"
        name="password"
        autoComplete="current-password"
        error={v.errorFor('password')}
        {...v.field}
      />
      <Captcha show={Boolean(error?.captchaRequired)} />
      <SubmitButton block pendingLabel="Checking…">
        Continue to verification
      </SubmitButton>
    </form>
  );
}

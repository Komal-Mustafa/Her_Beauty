'use client';

import { Captcha, type LoginResultState } from '@hb/auth/client';
import { FormAlert, Input, PasswordInput, SubmitButton, useFieldErrors } from '@hb/ui';
import Link from 'next/link';
import { useActionState } from 'react';
import { loginAction } from '@/app/(auth)/actions';
import { checks } from '@/lib/validation';

/** Email or mobile number + password. 2FA, when on, continues at /login/2fa. */
export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<LoginResultState | null, FormData>(loginAction, null);
  const error = state?.status === 'error' ? state : null;
  const v = useFieldErrors({ identifier: checks.identifier, password: checks.password }, error);
  return (
    <form action={action} onSubmit={v.onSubmit} noValidate className="space-y-5">
      <FormAlert state={state} />
      <input type="hidden" name="next" value={next} />
      <Input
        label="Email or mobile number"
        name="identifier"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        hint="Your mobile number works here once you’ve confirmed it in Security."
        defaultValue={error?.values?.identifier}
        error={v.errorFor('identifier')}
        {...v.field}
      />
      <div className="space-y-2">
        <PasswordInput
          label="Password"
          name="password"
          autoComplete="current-password"
          error={v.errorFor('password')}
          {...v.field}
        />
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="inline-flex min-h-11 items-center text-sm font-medium text-pink-600 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
      </div>
      <Captcha show={Boolean(error?.captchaRequired)} />
      <SubmitButton block pendingLabel="Logging in…">
        Log in
      </SubmitButton>
    </form>
  );
}

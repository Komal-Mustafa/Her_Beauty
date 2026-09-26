'use client';

import { Captcha, type CodeSentState, type LoginResultState } from '@hb/auth/client';
import { FormAlert, Input, PasswordInput, SubmitButton, useFieldErrors } from '@hb/ui';
import Link from 'next/link';
import { useActionState } from 'react';
import { loginAction, sendLoginCodeAction } from '@/app/(auth)/actions';
import { checks } from '@/lib/validation';

export function PasswordLoginForm({ next }: { next: string }) {
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

export function CodeLoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<CodeSentState | null, FormData>(sendLoginCodeAction, null);
  const error = state?.status === 'error' ? state : null;
  const v = useFieldErrors({ target: checks.mobile }, error);
  return (
    <form action={action} onSubmit={v.onSubmit} noValidate className="space-y-5">
      <FormAlert state={state} />
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="channel" value="sms" />
      <input type="hidden" name="purpose" value="login" />
      <Input
        label="Mobile number"
        name="target"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="0300 1234567"
        hint="We’ll text you a 6-digit code. New to Her Beauty? You can sign up with it too."
        defaultValue={error?.values?.target}
        error={v.errorFor('target')}
        {...v.field}
      />
      <Captcha show={Boolean(error?.captchaRequired)} />
      <SubmitButton block pendingLabel="Sending code…">
        Send code
      </SubmitButton>
    </form>
  );
}

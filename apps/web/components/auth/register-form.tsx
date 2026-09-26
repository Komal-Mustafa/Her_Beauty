'use client';

import { Captcha, type FieldErrors, type RegisterResultState } from '@hb/auth/client';
import { FormAlert, Input, PasswordInput, SubmitButton, useFieldErrors } from '@hb/ui';
import Link from 'next/link';
import { useActionState } from 'react';
import { registerAction } from '@/app/(auth)/actions';
import { checks, MESSAGES } from '@/lib/validation';

function needsEmailOrPhone(form: HTMLFormElement): FieldErrors {
  const email = form.elements.namedItem('email');
  const phone = form.elements.namedItem('phone');
  const empty = (el: unknown) => !(el instanceof HTMLInputElement) || el.value.trim() === '';
  return empty(email) && empty(phone) ? { email: MESSAGES.emailOrPhone } : {};
}

export function RegisterForm({ next }: { next: string }) {
  const [state, action] = useActionState<RegisterResultState | null, FormData>(
    registerAction,
    null,
  );
  const error = state?.status === 'error' ? state : null;
  const v = useFieldErrors(
    {
      fullName: checks.fullName,
      email: checks.email,
      phone: checks.phone,
      password: checks.newPassword,
    },
    error,
    { formCheck: needsEmailOrPhone },
  );
  return (
    <form action={action} onSubmit={v.onSubmit} noValidate className="space-y-5">
      <FormAlert state={state} />
      <input type="hidden" name="next" value={next} />
      <Input
        label="Full name"
        name="fullName"
        autoComplete="name"
        defaultValue={error?.values?.fullName}
        error={v.errorFor('fullName')}
        {...v.field}
      />
      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        hint="Add an email, a mobile number, or both."
        defaultValue={error?.values?.email}
        error={v.errorFor('email')}
        {...v.field}
      />
      <Input
        label="Mobile number"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="0300 1234567"
        defaultValue={error?.values?.phone}
        error={v.errorFor('phone')}
        {...v.field}
      />
      <PasswordInput
        label="Password"
        name="password"
        autoComplete="new-password"
        hint="At least 8 characters. A short phrase is easy to remember and hard to guess."
        error={v.errorFor('password')}
        {...v.field}
      />
      <Captcha show={Boolean(error?.captchaRequired)} />
      <SubmitButton block pendingLabel="Creating account…">
        Create account
      </SubmitButton>
      <p className="text-xs text-ink-500">
        By creating an account you agree to our{' '}
        <Link href="/policies/terms" className="text-pink-600 hover:underline">
          Terms of service
        </Link>{' '}
        and{' '}
        <Link href="/policies/privacy" className="text-pink-600 hover:underline">
          Privacy policy
        </Link>
        .
      </p>
    </form>
  );
}

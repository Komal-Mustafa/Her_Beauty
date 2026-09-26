'use client';

import { Captcha, type RegisterResultState } from '@hb/auth/client';
import { FormAlert, Input, PasswordInput, SubmitButton, useFieldErrors } from '@hb/ui';
import { useActionState } from 'react';
import { registerAction } from '@/app/(auth)/actions';
import { checkSellerType, checks } from '@/lib/validation';
import { SellerTypeChoice } from './seller-type-choice';

/**
 * Seller sign-up (b2-auth §7): Vendor or Manufacturer, store name, name, email, mobile and
 * password. The API creates the account and a draft store, then sends a code (→ /verify).
 */
export function RegisterForm({ defaultType }: { defaultType?: string }) {
  const [state, action] = useActionState<RegisterResultState | null, FormData>(
    registerAction,
    null,
  );
  const error = state?.status === 'error' ? state : null;
  const v = useFieldErrors(
    {
      storeName: checks.storeName,
      fullName: checks.fullName,
      email: checks.email,
      phone: checks.mobile,
      password: checks.newPassword,
    },
    error,
    { formCheck: checkSellerType },
  );
  return (
    <form action={action} onSubmit={v.onSubmit} noValidate className="space-y-5">
      <FormAlert state={state} />
      <SellerTypeChoice
        defaultValue={error?.values?.sellerType ?? defaultType}
        error={v.errorFor('sellerType')}
        field={v.field}
      />
      <Input
        label="Store name"
        name="storeName"
        autoComplete="organization"
        hint="Shoppers see this on your store and products. You can change it before you send your application."
        defaultValue={error?.values?.storeName}
        error={v.errorFor('storeName')}
        {...v.field}
      />
      <Input
        label="Your full name"
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
        Create seller account
      </SubmitButton>
      <p className="text-xs text-ink-500">
        We’ll send a 6-digit code to confirm your details. Your store stays private until our team
        approves your application.
      </p>
    </form>
  );
}

'use client';

import { Input, SubmitButton } from '@hb/ui';
import { useActionState } from 'react';
import { startApplicationAction, type ApplicationState } from '@/app/(portal)/actions';
import { FormAlert } from '@/components/auth/form-alert';
import { SellerTypeChoice } from '@/components/auth/seller-type-choice';
import { useFieldErrors } from '@/components/auth/use-field-errors';
import { checkSellerType, checks } from '@/lib/validation';

/** For signed-in users without a store: type + store name → draft application. */
export function ApplicationForm() {
  const [state, action] = useActionState<ApplicationState, FormData>(startApplicationAction, null);
  const error = state?.status === 'error' ? state : null;
  const v = useFieldErrors({ storeName: checks.storeName }, error, {
    formCheck: checkSellerType,
  });
  return (
    <form action={action} onSubmit={v.onSubmit} noValidate className="space-y-5">
      <FormAlert state={state} />
      <SellerTypeChoice
        defaultValue={error?.values?.sellerType}
        error={v.errorFor('sellerType')}
        field={v.field}
      />
      <Input
        label="Store name"
        name="storeName"
        autoComplete="organization"
        hint="Shoppers see this on your store and products."
        defaultValue={error?.values?.storeName}
        error={v.errorFor('storeName')}
        {...v.field}
      />
      <SubmitButton pendingLabel="Starting…" className="w-full sm:w-auto">
        Start your application
      </SubmitButton>
    </form>
  );
}

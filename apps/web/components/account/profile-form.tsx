'use client';

import type { ProfileState } from '@hb/auth/client';
import { FormAlert, Input, SubmitButton, useFieldErrors } from '@hb/ui';
import { useActionState } from 'react';
import { updateProfileAction } from '@/app/(shop)/account/actions';
import { checks } from '@/lib/validation';

export function ProfileForm({ fullName }: { fullName: string }) {
  const [state, action] = useActionState<ProfileState | null, FormData>(updateProfileAction, null);
  const error = state?.status === 'error' ? state : null;
  const v = useFieldErrors({ fullName: checks.fullName }, error);
  const current = state?.status === 'ok' ? state.user.fullName : fullName;
  return (
    <form action={action} onSubmit={v.onSubmit} noValidate className="space-y-4">
      <FormAlert state={state} />
      <Input
        label="Full name"
        name="fullName"
        autoComplete="name"
        defaultValue={error?.values?.fullName ?? current}
        error={v.errorFor('fullName')}
        {...v.field}
      />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton variant="secondary" size="sm" pendingLabel="Saving…">
          Save name
        </SubmitButton>
        {state?.status === 'ok' && (
          <p role="status" className="text-sm text-success">
            Saved
          </p>
        )}
      </div>
    </form>
  );
}

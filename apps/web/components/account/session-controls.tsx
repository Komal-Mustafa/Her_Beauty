'use client';

import type { DoneState } from '@hb/auth';
import { buttonVariants, cn, SubmitButton } from '@hb/ui';
import { useActionState } from 'react';
import { logoutAllAction, revokeSessionAction } from '@/app/(shop)/account/actions';

export function RevokeSessionButton({ id, device }: { id: string; device: string }) {
  const [state, action] = useActionState<DoneState | null, FormData>(revokeSessionAction, null);
  return (
    <form action={action} className="flex shrink-0 flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <SubmitButton
        variant="secondary"
        size="sm"
        pendingLabel="Signing out…"
        aria-label={`Sign out ${device}`}
      >
        Sign out
      </SubmitButton>
      {state?.status === 'error' && (
        <p role="alert" className="max-w-xs text-right text-xs text-danger">
          {state.message}
        </p>
      )}
    </form>
  );
}

/** Two-step (details/summary works without JavaScript): names the consequence before acting. */
export function SignOutEverywhere() {
  const [state, action] = useActionState<DoneState | null, FormData>(logoutAllAction, null);
  return (
    <details className="group">
      <summary
        className={cn(
          buttonVariants({ variant: 'secondary', size: 'sm' }),
          'cursor-pointer list-none [&::-webkit-details-marker]:hidden',
        )}
      >
        Sign out everywhere
      </summary>
      <form action={action} className="mt-4 space-y-3 rounded-btn border border-ink-200 p-4">
        <p className="text-sm text-ink-500">
          This signs you out on every device, including this one. You’ll need to log in again.
        </p>
        {state?.status === 'error' && (
          <p role="alert" className="text-sm text-danger">
            {state.message}
          </p>
        )}
        <SubmitButton size="sm" pendingLabel="Signing out…">
          Sign out on all devices
        </SubmitButton>
      </form>
    </details>
  );
}

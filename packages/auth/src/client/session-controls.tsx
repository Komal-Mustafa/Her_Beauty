'use client';

import { buttonVariants, cn, SubmitButton } from '@hb/ui';
import { useActionState } from 'react';
import type { DoneState } from '../results';
import type { FormAction } from './types';

/** "Sign out" for one other device. `action` wraps `auth.revokeSession()`. */
export function RevokeSessionButton({
  id,
  device,
  action: revokeAction,
}: {
  id: string;
  device: string;
  action: FormAction<DoneState>;
}) {
  const [state, action] = useActionState<DoneState | null, FormData>(revokeAction, null);
  return (
    <form action={action} className="flex shrink-0 flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <SubmitButton
        variant="secondary"
        size="sm"
        className="min-h-11"
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

/**
 * Two-step (details/summary works without JavaScript): names the consequence before acting.
 * `action` wraps `auth.logoutAll()`.
 */
export function SignOutEverywhere({ action: logoutAllAction }: { action: FormAction<DoneState> }) {
  const [state, action] = useActionState<DoneState | null, FormData>(logoutAllAction, null);
  return (
    <details className="group">
      <summary
        className={cn(
          buttonVariants({ variant: 'secondary', size: 'sm' }),
          'min-h-11 cursor-pointer list-none [&::-webkit-details-marker]:hidden',
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
        <SubmitButton size="sm" className="min-h-11" pendingLabel="Signing out…">
          Sign out on all devices
        </SubmitButton>
      </form>
    </details>
  );
}

'use client';

import type { CodeSentState } from '@hb/auth';
import { Alert, Button } from '@hb/ui';
import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { resendCodeAction } from '@/app/(auth)/actions';

const COOLDOWN_SEC = 60;

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function ResendButton({ waiting }: { waiting: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="ghost"
      size="sm"
      className="min-h-11"
      disabled={waiting || pending}
    >
      {pending ? 'Sending…' : 'Resend code'}
    </Button>
  );
}

/**
 * "Resend code" with a countdown. The server enforces the same cooldown, so without JavaScript
 * the button simply answers "you can ask again in N seconds".
 */
export function ResendCode({ resendInSec }: { resendInSec: number }) {
  const [state, action] = useActionState<CodeSentState | null, FormData>(resendCodeAction, null);
  const [left, setLeft] = useState(resendInSec);
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);
  useEffect(() => {
    if (state?.status === 'sent') setLeft(COOLDOWN_SEC);
    else if (state?.status === 'error' && state.retryAfterSec) setLeft(state.retryAfterSec);
  }, [state]);
  useEffect(() => {
    if (left <= 0) return;
    const timer = window.setTimeout(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [left]);

  // Before hydration the button stays usable (no-JS); after it, it waits for the countdown.
  const waiting = ready && left > 0;
  return (
    <form action={action} className="mt-6 space-y-3">
      {state?.status === 'sent' && (
        <Alert tone="success">We sent a new code to {state.target}.</Alert>
      )}
      {state?.status === 'error' && <Alert tone="danger">{state.message}</Alert>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-500">
        <span>Didn’t get it?</span>
        <ResendButton waiting={waiting} />
        {waiting && <span aria-hidden>Available in {clock(left)}</span>}
        <span className="sr-only" aria-live="polite">
          {ready && left === 0 ? 'You can ask for a new code now.' : ''}
        </span>
      </div>
    </form>
  );
}

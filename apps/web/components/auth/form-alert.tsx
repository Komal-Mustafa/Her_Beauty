import type { AuthError } from '@hb/auth';
import { Alert } from '@hb/ui';

/** Top-of-form message for any helper error (the copy already says how to recover). */
export function FormAlert({ state }: { state: { status: string } | null }) {
  if (!state || state.status !== 'error') return null;
  const error = state as AuthError;
  return (
    <Alert tone="danger" className="mb-5">
      {error.message}
    </Alert>
  );
}

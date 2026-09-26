import { Alert } from './alert';

type ActionState = { status: string; message?: string } | null | undefined;

/**
 * Top-of-form message for a server action's error result (`{ status: 'error', message }`). The
 * message already says how to recover; nothing renders for any other state.
 */
export function FormAlert({
  state,
  className = 'mb-5',
}: {
  state: ActionState;
  className?: string;
}) {
  if (!state || state.status !== 'error' || !state.message) return null;
  return (
    <Alert tone="danger" className={className}>
      {state.message}
    </Alert>
  );
}

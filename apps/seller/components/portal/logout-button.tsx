import { SubmitButton } from '@hb/ui';
import { logoutAction } from '@/app/(portal)/actions';

/** Ends this browser's session (always clears the cookies, even if the API is down). */
export function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={logoutAction} className={className}>
      <SubmitButton variant="quiet" size="sm" className="min-h-11" pendingLabel="Logging out…">
        Log out
      </SubmitButton>
    </form>
  );
}

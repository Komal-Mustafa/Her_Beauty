import type { Me } from '@hb/types';
import { Logo, SubmitButton } from '@hb/ui';
import { logoutAction } from '@/app/actions';
import { roleLabel } from '@/lib/auth';

/** Top bar of every console page: who is signed in, their role, and "Log out". */
export function ConsoleHeader({ me }: { me: Me }) {
  return (
    <header className="border-b border-ink-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Logo variant="seal" className="h-10" title="Her Beauty" />
          <p className="hidden font-display text-lg font-medium text-ink-900 sm:block">
            Admin console
          </p>
        </div>
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="min-w-0 text-right">
            <p className="truncate text-sm font-medium text-ink-900">{me.fullName}</p>
            <p className="text-xs text-ink-500">
              <span className="sr-only">Role: </span>
              {roleLabel(me.role)}
            </p>
          </div>
          <form action={logoutAction}>
            <SubmitButton variant="secondary" size="sm" pendingLabel="Logging out…">
              Log out
            </SubmitButton>
          </form>
        </div>
      </div>
    </header>
  );
}

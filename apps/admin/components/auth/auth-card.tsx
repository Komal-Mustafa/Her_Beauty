import { Alert, Button, Card, cn, Logo } from '@hb/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';

/** The centred sign-in card shared by /login, /login/2fa and /login/2fa/setup. */
export function AuthCard({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Card className={cn('w-full p-6 shadow-soft sm:p-8', wide ? 'max-w-md' : 'max-w-sm')}>
        <Logo />
        <div className="mt-8">{children}</div>
      </Card>
    </main>
  );
}

/** Shown when the 5-minute sign-in step is gone, or the API could not start it. */
export function StartOver({
  message,
  retryHref,
}: {
  message: string;
  /** Also offer "Try again" (outages, where the sign-in step itself may still be valid). */
  retryHref?: string;
}) {
  return (
    <>
      <h1 className="font-display text-[28px] font-medium leading-tight text-ink-900">
        Log in again
      </h1>
      <Alert tone="info" className="mt-6">
        {message}
      </Alert>
      <div className="mt-6 flex flex-col gap-3">
        <Button asChild block>
          <Link href="/login">Go to log in</Link>
        </Button>
        {retryHref && (
          <Button asChild block variant="secondary">
            <Link href={retryHref} prefetch={false}>
              Try again
            </Link>
          </Button>
        )}
      </div>
    </>
  );
}

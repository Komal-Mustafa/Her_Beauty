'use client';

import { Button, Card, Logo } from '@hb/ui';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

/**
 * Neutral error page (API unreachable, unexpected answer). It shows no account or console data,
 * so it is safe whoever is looking.
 */
export default function ConsoleError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function retry() {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm p-6 shadow-soft sm:p-8">
        <Logo />
        <h1 className="mt-8 font-display text-[28px] font-medium leading-tight text-ink-900">
          We couldn’t load the console
        </h1>
        <p className="mt-2 text-sm text-ink-500">
          Something went wrong on our side. Wait a moment, then try again.
        </p>
        <Button type="button" block className="mt-6" onClick={retry} disabled={pending}>
          {pending ? 'Trying again…' : 'Try again'}
        </Button>
      </Card>
    </main>
  );
}

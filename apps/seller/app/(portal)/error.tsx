'use client';

import { Alert, Button } from '@hb/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startTransition } from 'react';

/**
 * The API was unreachable or answered unexpectedly while loading a portal page. Nothing the
 * seller did is lost; offer a retry (re-fetches the server render) and a way back in.
 */
export default function PortalError({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  function retry() {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }
  return (
    <div className="mx-auto max-w-lg space-y-6 py-10">
      <h1 className="font-display text-[34px] font-semibold leading-tight text-ink-900">
        We couldn’t load this page
      </h1>
      <Alert tone="warning">
        Her Beauty didn’t answer in time. Your store and details are safe — try again in a moment.
      </Alert>
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={retry}>
          Try again
        </Button>
        <Button asChild variant="secondary">
          <Link href="/login" prefetch={false}>
            Go to log in
          </Link>
        </Button>
      </div>
    </div>
  );
}

'use client';

import { Button, EmptyState } from '@hb/ui';

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main" className="flex min-h-[60vh] items-center justify-center px-4">
      <EmptyState
        title="Something didn’t load"
        body="Your cart is safe. Try again, and if it keeps happening, come back in a few minutes."
        action={<Button onClick={reset}>Try again</Button>}
      />
    </main>
  );
}

import { Button, EmptyState, Logo } from '@hb/ui';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main
      id="main"
      className="flex min-h-dvh flex-col items-center justify-center bg-blush-50 px-4"
    >
      <Link href="/" prefetch={false} aria-label="Admin console overview" className="mb-4">
        <Logo />
      </Link>
      <EmptyState
        title="We couldn’t find that page"
        body="It may have moved, or it’s still being built."
        action={
          <Button asChild>
            <Link href="/" prefetch={false}>
              Go to the overview
            </Link>
          </Button>
        }
      />
    </main>
  );
}

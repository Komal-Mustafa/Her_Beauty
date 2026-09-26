import { Button, Card, Input, Logo } from '@hb/ui';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Admin log in' };

/*
 * P1 shell. P10 adds the real flow: password → mandatory 2FA (rules.md §5, admins always),
 * lockout after 5 failures, audit log entry on login.
 */
export default function AdminLoginPage() {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4">
      <Card className="w-full max-w-sm p-8 shadow-soft">
        <Logo />
        <h1 className="mt-8 font-display text-[28px] font-medium text-ink-900">Admin console</h1>
        <p className="mt-1 text-sm text-ink-500">
          Two-step verification is required for every admin.
        </p>
        <form className="mt-6 space-y-5" action="/login" method="post" noValidate>
          <Input label="Work email" name="email" type="email" autoComplete="username" required />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          <Button type="submit" block>
            Continue to verification
          </Button>
        </form>
      </Card>
    </main>
  );
}

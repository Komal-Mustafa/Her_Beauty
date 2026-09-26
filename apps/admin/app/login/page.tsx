import { safeNextPath } from '@hb/auth';
import { Alert } from '@hb/ui';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/auth/auth-card';
import { LoginForm } from '@/components/auth/login-form';
import { signedInAdmin } from '@/lib/auth';

export const metadata: Metadata = { title: 'Admin log in' };

// Neutral wording: the page never says why an account has no access (security.md §4).
const NOTICES: Record<string, { tone: 'info' | 'success'; text: string }> = {
  'signed-out': { tone: 'success', text: 'You’re logged out.' },
  'no-access': {
    tone: 'info',
    text: 'You’ve been logged out. This account can’t use the admin console. If you need access, ask a super admin.',
  },
};

type Search = { next?: string; notice?: string };

/** Step 1: work email + password. Mandatory 2FA follows (rules.md §5: always for admins). */
export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next, '/');
  if (await signedInAdmin()) redirect(next);
  const notice = params.notice ? NOTICES[params.notice] : undefined;

  return (
    <AuthCard>
      <h1 className="font-display text-[28px] font-medium text-ink-900">Admin console</h1>
      <p className="mt-1 text-sm text-ink-500">
        Two-step verification is required for every admin.
      </p>
      {notice && (
        <Alert tone={notice.tone} className="mt-6">
          {notice.text}
        </Alert>
      )}
      <div className="mt-6">
        <LoginForm next={next} />
      </div>
    </AuthCard>
  );
}

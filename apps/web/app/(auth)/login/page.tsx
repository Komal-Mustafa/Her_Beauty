import { safeNextPath } from '@hb/auth';
import { Alert, Tabs } from '@hb/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CodeLoginForm, PasswordLoginForm } from '@/components/auth/login-forms';
import { signedInUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Log in' };

const NOTICES: Record<string, string> = {
  'password-reset': 'Your password is changed. Log in with your new password.',
  'signed-out-everywhere': 'You’re signed out on every device.',
};

type Search = { next?: string; method?: string; notice?: string };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next, '/account');
  if (await signedInUser()) redirect(next);

  const method = params.method === 'code' ? 'code' : 'password';
  const query = (m: string) => {
    const q = new URLSearchParams({ method: m });
    if (params.next) q.set('next', next);
    return `?${q.toString()}`;
  };
  const notice = params.notice ? NOTICES[params.notice] : undefined;
  const registerHref = params.next ? `/register?next=${encodeURIComponent(next)}` : '/register';

  return (
    <>
      <h1 className="font-display text-[34px] font-semibold leading-tight text-ink-900">
        Welcome back
      </h1>
      <p className="mt-2 text-ink-500">Log in to track orders and check out faster.</p>
      {notice && (
        <Alert tone="success" className="mt-6">
          {notice}
        </Alert>
      )}
      <Tabs
        className="mt-8"
        label="Log in with"
        defaultValue={method}
        items={[
          {
            id: 'password',
            label: 'Password',
            href: query('password'),
            content: <PasswordLoginForm next={next} />,
          },
          {
            id: 'code',
            label: 'Mobile code',
            href: query('code'),
            content: <CodeLoginForm next={next} />,
          },
        ]}
      />
      <p className="mt-8 text-center text-sm text-ink-500">
        New to Her Beauty?{' '}
        <Link href={registerHref} className="font-medium text-pink-600 hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}

import { ApiRequestError } from '@hb/auth';
import type { SessionInfo } from '@hb/types';
import { Alert, Badge, Card, SectionHeading } from '@hb/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { LogoutButton } from '@/components/portal/logout-button';
import { RevokeSessionButton, SignOutEverywhere } from '@/components/portal/session-controls';
import { TwoFactorPanel } from '@/components/portal/two-factor-panel';
import { auth } from '@/lib/auth';
import { describeUserAgent, formatDateTime } from '@/lib/user-agent';

export const metadata: Metadata = { title: 'Security' };

const APP_NAMES: Record<SessionInfo['audience'], string> = {
  web: 'Shop',
  seller: 'Seller portal',
  admin: 'Admin',
};

function CardHeading({ children }: { children: ReactNode }) {
  return <h2 className="mb-5 font-display text-[22px] font-medium text-ink-900">{children}</h2>;
}

function SessionsList({ sessions }: { sessions: SessionInfo[] | null }) {
  if (!sessions) {
    return (
      <Alert tone="warning">
        We couldn’t load your devices just now. Refresh the page to try again.
      </Alert>
    );
  }
  return (
    <ul className="divide-y divide-ink-200">
      {sessions.map((s) => {
        const device = describeUserAgent(s.userAgent);
        return (
          <li key={s.id} className="flex items-start justify-between gap-4 py-4">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-medium text-ink-900">
                {device}
                {s.current && <Badge kind="success">This device</Badge>}
              </p>
              <p className="break-words text-sm text-ink-500">
                {APP_NAMES[s.audience]} · Last active {formatDateTime(s.lastUsedAt ?? s.createdAt)}
                {s.ip ? ` · ${s.ip}` : ''}
              </p>
            </div>
            {!s.current && <RevokeSessionButton id={s.id} device={device} />}
          </li>
        );
      })}
    </ul>
  );
}

async function loadSessions(): Promise<SessionInfo[] | null> {
  try {
    return await auth.listSessions();
  } catch (error) {
    if (error instanceof ApiRequestError) return null; // shown as a warning in the card
    throw error;
  }
}

export default async function SecurityPage() {
  const me = await auth.requireSession('/security');
  const sessions = await loadSessions();

  return (
    <>
      <SectionHeading
        as="h1"
        eyebrow="Seller portal"
        title="Security"
        description="How you log in, and where you’re logged in. Your seller login also works on the Her Beauty shop."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5 md:p-8">
          <CardHeading>Log-in and two-factor</CardHeading>
          <div className="flex items-start justify-between gap-4 border-b border-ink-200 pb-5">
            <div className="min-w-0">
              <p className="font-medium text-ink-900">Password</p>
              <p className="text-sm text-ink-500">
                {me.hasPassword
                  ? 'Set. Changing it logs you out on every device.'
                  : 'Not set yet. Set one to log in to the seller portal.'}
              </p>
            </div>
            <Link
              href="/forgot-password"
              prefetch={false}
              className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-pink-600 hover:underline"
            >
              {me.hasPassword ? 'Change password' : 'Set a password'}
            </Link>
          </div>
          <div className="pt-5">
            <TwoFactorPanel enabled={me.twoFactorEnabled} hasPassword={me.hasPassword} />
          </div>
        </Card>

        <Card className="p-5 md:p-8">
          <CardHeading>Where you’re logged in</CardHeading>
          <SessionsList sessions={sessions} />
          <div className="mt-6 flex flex-col gap-4 border-t border-ink-200 pt-6 sm:flex-row sm:items-start sm:justify-between">
            <SignOutEverywhere />
            <LogoutButton />
          </div>
        </Card>
      </div>
    </>
  );
}

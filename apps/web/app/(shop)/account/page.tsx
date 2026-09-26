import { ApiRequestError } from '@hb/auth';
import type { Me, SessionInfo } from '@hb/types';
import { Alert, Badge, Card, Container, SectionHeading, SubmitButton } from '@hb/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ProfileForm } from '@/components/account/profile-form';
import { RevokeSessionButton, SignOutEverywhere } from '@/components/account/session-controls';
import { TwoFactorPanel } from '@/components/account/two-factor-panel';
import { VerifyContactButton } from '@/components/account/verify-contact-button';
import { auth } from '@/lib/auth';
import { describeUserAgent, formatDateTime } from '@/lib/user-agent';
import { logoutAction } from './actions';

export const metadata: Metadata = {
  title: 'Your account',
  robots: { index: false, follow: false },
};

const APP_NAMES: Record<SessionInfo['audience'], string> = {
  web: 'Shop',
  seller: 'Seller portal',
  admin: 'Admin',
};

function CardHeading({ children }: { children: ReactNode }) {
  return <h2 className="mb-5 font-display text-[22px] font-medium text-ink-900">{children}</h2>;
}

function ContactRow({
  label,
  value,
  verified,
  channel,
}: {
  label: string;
  value: string | null;
  verified: boolean;
  channel: 'sms' | 'email';
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="min-w-0">
        <p className="text-sm text-ink-500">{label}</p>
        <p className="break-words font-medium text-ink-900">{value ?? 'Not added'}</p>
        {value && (
          <Badge kind={verified ? 'success' : 'warning'} className="mt-1">
            {verified ? 'Verified' : 'Not verified'}
          </Badge>
        )}
      </div>
      {value && !verified && (
        <VerifyContactButton
          channel={channel}
          target={value}
          label={`Verify ${label.toLowerCase()}`}
        />
      )}
    </div>
  );
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
              <p className="text-sm text-ink-500">
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

function firstName(me: Me): string {
  return me.fullName.trim().split(/\s+/)[0] || 'there';
}

export default async function AccountPage() {
  const me = await auth.requireSession('/account');
  const sessions = await loadSessions();

  return (
    <Container className="py-10 md:py-16">
      <SectionHeading
        as="h1"
        eyebrow="Your account"
        title={`Hello, ${firstName(me)}`}
        description="Your details, how you sign in, and where you’re signed in."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5 md:p-8">
          <CardHeading>Profile</CardHeading>
          <ProfileForm fullName={me.fullName} />
          <div className="mt-6 divide-y divide-ink-200 border-t border-ink-200">
            <ContactRow
              label="Email"
              value={me.email}
              verified={me.emailVerified}
              channel="email"
            />
            <ContactRow
              label="Mobile number"
              value={me.phone}
              verified={me.phoneVerified}
              channel="sms"
            />
          </div>
        </Card>

        <Card className="p-5 md:p-8">
          <CardHeading>Sign-in and security</CardHeading>
          <div className="flex items-start justify-between gap-4 border-b border-ink-200 pb-5">
            <div>
              <p className="font-medium text-ink-900">Password</p>
              <p className="text-sm text-ink-500">
                {me.hasPassword
                  ? 'Set. You can also log in with a code sent to your mobile.'
                  : 'Not set. You log in with a code sent to your mobile or email.'}
              </p>
            </div>
            <Link
              href="/forgot-password"
              className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-pink-600 hover:underline"
            >
              {me.hasPassword ? 'Change password' : 'Set a password'}
            </Link>
          </div>
          <div className="pt-5">
            <TwoFactorPanel enabled={me.twoFactorEnabled} hasPassword={me.hasPassword} />
          </div>
        </Card>

        <Card className="p-5 md:p-8 lg:col-span-2">
          <CardHeading>Where you’re signed in</CardHeading>
          <SessionsList sessions={sessions} />
          <div className="mt-6 flex flex-col gap-4 border-t border-ink-200 pt-6 sm:flex-row sm:items-start sm:justify-between">
            <SignOutEverywhere />
            <form action={logoutAction}>
              <SubmitButton variant="quiet" size="sm" pendingLabel="Logging out…">
                Log out
              </SubmitButton>
            </form>
          </div>
        </Card>
      </div>
    </Container>
  );
}

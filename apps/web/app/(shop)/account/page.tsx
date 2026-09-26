import { ApiRequestError } from '@hb/auth';
import { ContactRow, SessionList, SignOutEverywhere, TwoFactorPanel } from '@hb/auth/client';
import type { Me, SessionInfo } from '@hb/types';
import { Card, Container, SectionHeading, SubmitButton } from '@hb/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ProfileForm } from '@/components/account/profile-form';
import { auth } from '@/lib/auth';
import {
  disableTwoFactorAction,
  logoutAction,
  logoutAllAction,
  revokeSessionAction,
  sendVerificationAction,
  twoFactorAction,
} from './actions';

export const metadata: Metadata = {
  title: 'Your account',
  robots: { index: false, follow: false },
};

function CardHeading({ children }: { children: ReactNode }) {
  return <h2 className="mb-5 font-display text-[22px] font-medium text-ink-900">{children}</h2>;
}

/**
 * The shop's code log-in is by mobile only, so it is offered only to accounts with a confirmed
 * mobile number (an email-only account cannot use it).
 */
function passwordSummary(me: Me): string {
  const codeLogin = me.phone !== null && me.phoneVerified;
  if (me.hasPassword) {
    return codeLogin ? 'Set. You can also log in with a code sent to your mobile.' : 'Set.';
  }
  return codeLogin
    ? 'Not set. You log in with a code sent to your mobile.'
    : 'Not set. Set one so you can log in with your email.';
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
      {/* grid-cols-1 + min-w-0: a long email must wrap, not widen the page (360 px). */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="min-w-0 p-5 md:p-8">
          <CardHeading>Profile</CardHeading>
          <ProfileForm fullName={me.fullName} />
          <div className="mt-6 divide-y divide-ink-200 border-t border-ink-200">
            <ContactRow
              label="Email"
              value={me.email}
              verified={me.emailVerified}
              channel="email"
              verifyAction={sendVerificationAction}
            />
            <ContactRow
              label="Mobile number"
              value={me.phone}
              verified={me.phoneVerified}
              channel="sms"
              verifyAction={sendVerificationAction}
            />
          </div>
        </Card>

        <Card className="min-w-0 p-5 md:p-8">
          <CardHeading>Sign-in and security</CardHeading>
          <div className="flex items-start justify-between gap-4 border-b border-ink-200 pb-5">
            <div className="min-w-0">
              <p className="font-medium text-ink-900">Password</p>
              <p className="text-sm text-ink-500">{passwordSummary(me)}</p>
            </div>
            <Link
              href="/forgot-password"
              className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-pink-600 hover:underline"
            >
              {me.hasPassword ? 'Change password' : 'Set a password'}
            </Link>
          </div>
          <div className="pt-5">
            <TwoFactorPanel
              enabled={me.twoFactorEnabled}
              hasPassword={me.hasPassword}
              enrolAction={twoFactorAction}
              disableAction={disableTwoFactorAction}
              description="Add a code from an authenticator app when you log in with your password, so a stolen password alone can’t open your account."
            />
          </div>
        </Card>

        <Card className="min-w-0 p-5 md:p-8 lg:col-span-2">
          <CardHeading>Where you’re signed in</CardHeading>
          <SessionList sessions={sessions} revokeAction={revokeSessionAction} />
          <div className="mt-6 flex flex-col gap-4 border-t border-ink-200 pt-6 sm:flex-row sm:items-start sm:justify-between">
            <SignOutEverywhere action={logoutAllAction} />
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

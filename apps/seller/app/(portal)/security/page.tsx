import { ApiRequestError } from '@hb/auth';
import { ContactRow, SessionList, SignOutEverywhere, TwoFactorPanel } from '@hb/auth/client';
import type { SessionInfo } from '@hb/types';
import { Card, SectionHeading } from '@hb/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  disableTwoFactorAction,
  logoutAllAction,
  revokeSessionAction,
  sendVerificationAction,
  twoFactorAction,
} from '@/app/(portal)/actions';
import { LogoutButton } from '@/components/portal/logout-button';
import { auth } from '@/lib/auth';

export const metadata: Metadata = { title: 'Security' };

function CardHeading({ children }: { children: ReactNode }) {
  return <h2 className="mb-5 font-display text-[22px] font-medium text-ink-900">{children}</h2>;
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="min-w-0 p-5 md:p-8">
          <CardHeading>Log-in and two-factor</CardHeading>
          {/* Seller sign-up confirms the email only; the mobile number works for log-in once it
              is confirmed here (b2-auth §1: email or phone + password). */}
          <div className="divide-y divide-ink-200 border-b border-ink-200">
            <ContactRow
              label="Email"
              value={me.email}
              verified={me.emailVerified}
              channel="email"
              verifyAction={sendVerificationAction}
              hint="Confirm it to log in with your email."
            />
            <ContactRow
              label="Mobile number"
              value={me.phone}
              verified={me.phoneVerified}
              channel="sms"
              verifyAction={sendVerificationAction}
              hint="Confirm it to log in with your mobile number too."
            />
          </div>
          <div className="flex items-start justify-between gap-4 border-b border-ink-200 py-5">
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
            <TwoFactorPanel
              enabled={me.twoFactorEnabled}
              hasPassword={me.hasPassword}
              enrolAction={twoFactorAction}
              disableAction={disableTwoFactorAction}
              description="Add a code from an authenticator app when you log in with your password, so a stolen password alone can’t open your store. You’ll need it before you can request payouts or change bank or courier details."
            />
          </div>
        </Card>

        <Card className="min-w-0 p-5 md:p-8">
          <CardHeading>Where you’re logged in</CardHeading>
          <SessionList sessions={sessions} revokeAction={revokeSessionAction} />
          <div className="mt-6 flex flex-col gap-4 border-t border-ink-200 pt-6 sm:flex-row sm:items-start sm:justify-between">
            <SignOutEverywhere action={logoutAllAction} />
            <LogoutButton />
          </div>
        </Card>
      </div>
    </>
  );
}

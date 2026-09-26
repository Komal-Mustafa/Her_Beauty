import { ApiRequestError } from '@hb/auth';
import { SellerProfile, type Me, type SellerMembership } from '@hb/types';
import { Card, SectionHeading } from '@hb/ui';
import type { Metadata } from 'next';
import { ApplicationForm } from '@/components/portal/application-form';
import { ApplicationStatus, type SellerSummary } from '@/components/portal/application-status';
import { LogoutButton } from '@/components/portal/logout-button';
import { auth } from '@/lib/auth';

export const metadata: Metadata = { title: 'Dashboard' };

function firstName(me: Me): string {
  return me.fullName.trim().split(/\s+/)[0] || 'there';
}

/**
 * GET /seller/me adds the review note and dates. It needs the seller context in the token; if
 * that is missing (membership added after this token was issued) or the call fails, the
 * membership summary from /me still shows the status.
 */
async function loadSeller(membership: SellerMembership): Promise<SellerSummary> {
  try {
    const profile = await auth.apiFetch('/seller/me', SellerProfile);
    return {
      status: profile.status,
      type: profile.type,
      storeName: profile.storeName,
      role: profile.role,
      reviewNote: profile.reviewNote,
      submittedAt: profile.submittedAt,
    };
  } catch (error) {
    if (!(error instanceof ApiRequestError)) throw error;
    return {
      status: membership.status,
      type: membership.type,
      storeName: membership.storeName,
      role: membership.role,
      reviewNote: null,
      submittedAt: null,
    };
  }
}

export default async function DashboardPage() {
  const me = await auth.requireSession('/dashboard');

  if (!me.seller) {
    return (
      <>
        <SectionHeading
          as="h1"
          eyebrow="Seller portal"
          title={`Welcome, ${firstName(me)}`}
          description="You’re logged in, but there’s no store on your account yet. Start your application to sell on Her Beauty."
        />
        <section aria-labelledby="start-application-heading" className="max-w-3xl">
          <Card className="p-5 md:p-8">
            <h2
              id="start-application-heading"
              className="font-display text-[22px] font-medium text-ink-900 md:text-[26px]"
            >
              Start your application
            </h2>
            <p className="mb-6 mt-2 text-ink-500">
              Choose how you sell and name your store. You can add business details, brands and
              documents after this step.
            </p>
            <ApplicationForm />
            <div className="mt-6 flex justify-end border-t border-ink-200 pt-4">
              <LogoutButton />
            </div>
          </Card>
        </section>
      </>
    );
  }

  const seller = await loadSeller(me.seller);
  return (
    <>
      <SectionHeading
        as="h1"
        eyebrow="Seller portal"
        title={`Hello, ${firstName(me)}`}
        description={seller.storeName ? `Here’s where ${seller.storeName} stands.` : undefined}
      />
      <ApplicationStatus seller={seller} />
    </>
  );
}

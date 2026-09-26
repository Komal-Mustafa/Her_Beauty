import { ApiRequestError } from '@hb/auth';
import { AdminOverview, SellerStatus } from '@hb/types';
import { Badge } from '@hb/ui';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ConsoleHeader } from '@/components/console/console-header';
import { formatCount, StatCard } from '@/components/console/stat-card';
import { auth, isAdminRole, NO_ACCESS_PATH } from '@/lib/auth';

export const metadata: Metadata = { title: 'Overview' };

const SELLER_STATUS: Record<SellerStatus, { label: string; hint: string }> = {
  draft: { label: 'Draft', hint: 'Application not sent yet' },
  submitted: { label: 'Submitted', hint: 'Waiting for review' },
  changes_requested: { label: 'Changes requested', hint: 'Waiting on the seller' },
  approved: { label: 'Approved', hint: 'Can sell' },
  rejected: { label: 'Rejected', hint: 'Application declined' },
  suspended: { label: 'Suspended', hint: 'Selling paused' },
};

/**
 * Counts from GET /admin/overview. A 403 (not an admin role, no 2FA on the session, wrong
 * audience) signs the session out before anything renders; the console never shows a non-admin
 * anything but the login page.
 */
async function loadOverview(): Promise<AdminOverview> {
  try {
    return await auth.apiFetch('/admin/overview', AdminOverview);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 403) redirect(NO_ACCESS_PATH);
    if (error instanceof ApiRequestError && error.status === 401) redirect('/login?next=%2F');
    throw error;
  }
}

export default async function OverviewPage() {
  const me = await auth.requireSession('/');
  if (!isAdminRole(me.role)) redirect(NO_ACCESS_PATH);
  const overview = await loadOverview();
  const sellerTotal = SellerStatus.options.reduce((sum, s) => sum + overview.sellers[s], 0);

  return (
    <>
      <ConsoleHeader me={me} />
      <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="font-display text-[28px] font-medium text-ink-900">Overview</h1>
        <p className="mt-1 text-sm text-ink-500">
          The marketplace right now. Reload the page for the latest numbers.
        </p>

        <section aria-labelledby="totals-heading" className="mt-8">
          <h2 id="totals-heading" className="sr-only">
            Totals
          </h2>
          <dl className="grid gap-4 sm:grid-cols-3">
            <StatCard
              size="lg"
              label="Live products"
              value={overview.liveProducts}
              hint="In the shop now"
            />
            <StatCard size="lg" label="Users" value={overview.users} hint="All accounts" />
            <StatCard size="lg" label="Orders" value={overview.orders} hint="All time" />
          </dl>
        </section>

        <section aria-labelledby="sellers-heading" className="mt-10">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="sellers-heading" className="font-sans text-base font-medium text-ink-900">
              Sellers by status
            </h2>
            <p className="text-sm text-ink-500">{formatCount(sellerTotal)} in total</p>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {SellerStatus.options.map((status) => (
              <StatCard
                key={status}
                label={SELLER_STATUS[status].label}
                value={overview.sellers[status]}
                hint={SELLER_STATUS[status].hint}
                badge={
                  status === 'submitted' && overview.sellers.submitted > 0 ? (
                    <Badge kind="warning">Needs review</Badge>
                  ) : undefined
                }
              />
            ))}
          </dl>
        </section>
      </main>
    </>
  );
}

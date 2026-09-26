import type { SellerMemberRole, SellerStatus, SellerType } from '@hb/types';
import { Alert, Badge, Card, Stepper } from '@hb/ui';
import {
  AlertTriangle,
  BadgeCheck,
  FilePenLine,
  Hourglass,
  PauseCircle,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { formatDateTime } from '@/lib/user-agent';
import { LogoutButton } from './logout-button';

export type SellerSummary = {
  status: SellerStatus;
  type: SellerType;
  storeName: string | null;
  role: SellerMemberRole;
  reviewNote: string | null;
  submittedAt: string | null;
};

type StatusCopy = {
  label: string;
  badge: 'info' | 'success' | 'warning' | 'danger';
  icon: LucideIcon;
  title: string;
  next: string;
  /** Stepper position; null hides the stepper (closed outcomes). */
  step: number | null;
};

// TODO [CONFIRM]: seller support contact (email/WhatsApp) for the rejected/suspended copy.
const STATUS: Record<SellerStatus, StatusCopy> = {
  draft: {
    label: 'Draft',
    badge: 'info',
    icon: FilePenLine,
    title: 'Finish your application',
    next: 'Next, add your business details, brands and documents, then send your application for review. These steps open here soon — your store name and type are saved.',
    step: 1,
  },
  submitted: {
    label: 'Under review',
    badge: 'info',
    icon: Hourglass,
    title: 'We’re reviewing your application',
    next: 'Our team is checking your details and documents. There’s nothing you need to do right now — we’ll let you know when there’s a decision.',
    step: 2,
  },
  changes_requested: {
    label: 'Changes needed',
    badge: 'warning',
    icon: AlertTriangle,
    title: 'A few changes are needed',
    next: 'Our team asked for some changes. Update the details in the note below, then send your application again.',
    step: 1,
  },
  approved: {
    label: 'Approved',
    badge: 'success',
    icon: BadgeCheck,
    title: 'Your store is approved',
    next: 'Welcome to Her Beauty! Next, choose a selling plan and add your first products. These tools open here soon.',
    step: 4,
  },
  rejected: {
    label: 'Not approved',
    badge: 'danger',
    icon: XCircle,
    title: 'Your application wasn’t approved',
    next: 'Our reason is below. If something has changed, or you think we got it wrong, contact seller support to ask for another review.',
    step: null,
  },
  suspended: {
    label: 'Suspended',
    badge: 'danger',
    icon: PauseCircle,
    title: 'Your store is paused',
    next: 'Your store and products are hidden from shoppers for now. Contact seller support to find out what’s needed to restore it.',
    step: null,
  },
};

const STEPS = [
  { id: 'account', label: 'Account' },
  { id: 'application', label: 'Application' },
  { id: 'review', label: 'Review' },
  { id: 'approved', label: 'Approved' },
];

const TYPE_LABEL: Record<SellerType, string> = {
  vendor: 'Vendor — sells authorised brands',
  manufacturer: 'Manufacturer — owns a brand',
};

const ROLE_LABEL: Record<SellerMemberRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  catalog: 'Catalogue',
  orders: 'Orders',
  finance: 'Finance',
};

/** The application status card: where the store stands, what happens next, and log out. */
export function ApplicationStatus({ seller }: { seller: SellerSummary }) {
  const copy = STATUS[seller.status];
  const Icon = copy.icon;
  const showNote =
    seller.reviewNote &&
    (seller.status === 'changes_requested' ||
      seller.status === 'rejected' ||
      seller.status === 'suspended');
  return (
    <section aria-labelledby="application-status-heading" className="max-w-3xl">
      <Card className="p-5 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-pill bg-blush-50 text-pink-700">
              <Icon aria-hidden className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm text-ink-500">Application status</p>
              <h2
                id="application-status-heading"
                className="font-display text-[22px] font-medium leading-snug text-ink-900 md:text-[26px]"
              >
                {copy.title}
              </h2>
            </div>
          </div>
          <Badge kind={copy.badge}>{copy.label}</Badge>
        </div>

        {copy.step !== null && <Stepper steps={STEPS} current={copy.step} className="mt-8" />}

        <div className="mt-8 rounded-btn border border-gold-500 bg-blush-50 p-4">
          <p className="eyebrow text-gold-800">Next step</p>
          <p className="mt-1 text-ink-900">{copy.next}</p>
        </div>

        {showNote && (
          <Alert
            tone={seller.status === 'changes_requested' ? 'warning' : 'danger'}
            role="note"
            title="Note from our review team"
            className="mt-4"
          >
            <p className="whitespace-pre-line break-words">{seller.reviewNote}</p>
          </Alert>
        )}

        <dl className="mt-8 grid gap-x-6 gap-y-4 border-t border-ink-200 pt-6 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-ink-500">Store name</dt>
            <dd className="break-words font-medium text-ink-900">
              {seller.storeName ?? 'Not set yet'}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-500">Seller type</dt>
            <dd className="font-medium text-ink-900">{TYPE_LABEL[seller.type]}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-500">Your role</dt>
            <dd className="font-medium text-ink-900">{ROLE_LABEL[seller.role]}</dd>
          </div>
          {seller.submittedAt && (
            <div>
              <dt className="text-sm text-ink-500">Sent for review</dt>
              <dd className="font-medium text-ink-900">{formatDateTime(seller.submittedAt)}</dd>
            </div>
          )}
        </dl>

        <div className="mt-6 flex justify-end border-t border-ink-200 pt-4">
          <LogoutButton />
        </div>
      </Card>
    </section>
  );
}

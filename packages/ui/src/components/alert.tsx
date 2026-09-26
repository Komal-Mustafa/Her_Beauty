import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const ICON = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  info: Info,
} as const;
const BAR = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
} as const;
const TEXT = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
} as const;

type AlertProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
};

/**
 * Inline message for a form or page (toast look, but stays put). Danger alerts use role="alert"
 * so screen readers announce them at once; the others are polite status messages.
 */
export function Alert({ tone = 'info', title, children, className, role, ...props }: AlertProps) {
  const Icon = ICON[tone];
  return (
    <div
      role={role ?? (tone === 'danger' ? 'alert' : 'status')}
      className={cn(
        'relative flex gap-3 overflow-hidden rounded-btn border border-ink-200 bg-white p-4 pl-5',
        className,
      )}
      {...props}
    >
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', BAR[tone])} />
      <Icon aria-hidden className={cn('mt-0.5 h-5 w-5 shrink-0', TEXT[tone])} />
      <div className="min-w-0 flex-1 text-sm">
        {title && <p className="font-medium text-ink-900">{title}</p>}
        {children && <div className={cn('text-ink-500', title ? 'mt-0.5' : '')}>{children}</div>}
      </div>
    </div>
  );
}

import { BadgeCheck, Box, Crown } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

// 04-ui-ux §5 badge specs. Text is 12 px, so it needs 4.5:1 on white (WCAG 2.1 AA, rules.md §7).
// The success (4.3:1) and warning (3.6:1) status colours are too light for small text: those
// badges use ink text with the status colour on the border and a dot (the dot and border only
// need 3:1), which also keeps status from being carried by colour alone (04-ui-ux §9).
const STYLES = {
  verified: 'bg-pink-100 text-pink-700',
  official: 'border border-gold-500 bg-white text-gold-800',
  sponsored: 'bg-ink-200 text-ink-500',
  threeD: 'border border-gold-600 bg-white/90 text-gold-800',
  new: 'bg-pink-600 text-white',
  sale: 'bg-white text-pink-700 border border-pink-200',
  success: 'bg-white text-ink-900 border border-success',
  warning: 'bg-white text-ink-900 border border-warning',
  danger: 'bg-white text-danger border border-danger',
  info: 'bg-white text-info border border-info',
} as const;

const DEFAULT_LABELS: Partial<Record<keyof typeof STYLES, string>> = {
  verified: 'Verified Seller',
  official: 'Official Brand',
  sponsored: 'Sponsored',
  threeD: '3D',
  new: 'New',
};

const dot = (color: string) => (
  <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-pill', color)} />
);

const ICONS: Partial<Record<keyof typeof STYLES, ReactNode>> = {
  verified: <BadgeCheck aria-hidden className="h-3.5 w-3.5" />,
  official: <Crown aria-hidden className="h-3.5 w-3.5" />,
  threeD: <Box aria-hidden className="h-3.5 w-3.5" />,
  success: dot('bg-success'),
  warning: dot('bg-warning'),
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & { kind: keyof typeof STYLES };

export function Badge({ kind, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-xs font-medium leading-5',
        STYLES[kind],
        className,
      )}
      {...props}
    >
      {ICONS[kind]}
      {children ?? DEFAULT_LABELS[kind]}
    </span>
  );
}

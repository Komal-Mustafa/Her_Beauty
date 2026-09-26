import { BadgeCheck, Box, Crown } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

// 04-ui-ux §5 badge specs.
const STYLES = {
  verified: 'bg-pink-100 text-pink-700',
  official: 'border border-gold-500 bg-white text-gold-800',
  sponsored: 'bg-ink-200 text-ink-500',
  threeD: 'border border-gold-600 bg-white/90 text-gold-800',
  new: 'bg-pink-600 text-white',
  sale: 'bg-white text-pink-700 border border-pink-200',
  success: 'bg-white text-success border border-success',
  warning: 'bg-white text-warning border border-warning',
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

const ICONS: Partial<Record<keyof typeof STYLES, ReactNode>> = {
  verified: <BadgeCheck aria-hidden className="h-3.5 w-3.5" />,
  official: <Crown aria-hidden className="h-3.5 w-3.5" />,
  threeD: <Box aria-hidden className="h-3.5 w-3.5" />,
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

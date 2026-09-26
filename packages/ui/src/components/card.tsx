import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** premium = 1px gold border (Luxe), interactive = lift on hover. */
  tone?: 'default' | 'premium' | 'blush';
  interactive?: boolean;
};

export function Card({ className, tone = 'default', interactive = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-card bg-white',
        tone === 'default' && 'border border-ink-200',
        tone === 'premium' && 'border border-gold-500',
        tone === 'blush' && 'bg-blush-50',
        interactive && 'transition duration-base hover:-translate-y-1 hover:shadow-lift',
        className,
      )}
      {...props}
    />
  );
}

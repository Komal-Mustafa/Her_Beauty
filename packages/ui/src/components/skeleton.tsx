import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

/** 04-ui-ux §5: blush-50 blocks with soft shimmer. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn('rounded-btn bg-blush-50 animate-skeleton', className)}
      {...props}
    />
  );
}

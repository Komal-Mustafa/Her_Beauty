import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

type EmptyStateProps = { title: string; body?: string; action?: ReactNode; className?: string };

/** 04-ui-ux §5: line illustration in pink-200/gold-500, one sentence, one CTA. */
export function EmptyState({ title, body, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-16 text-center', className)}>
      <svg aria-hidden viewBox="0 0 120 120" className="mb-6 h-28 w-28" fill="none">
        <circle cx="60" cy="60" r="52" className="stroke-pink-200" strokeWidth="2" />
        <circle
          cx="60"
          cy="60"
          r="44"
          className="stroke-gold-500"
          strokeWidth="1"
          strokeDasharray="3 5"
        />
        <rect
          x="50"
          y="34"
          width="20"
          height="44"
          rx="4"
          className="stroke-gold-500"
          strokeWidth="2"
        />
        <path
          d="M52 34 L60 22 L68 30 L68 34"
          className="stroke-pink-400"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M46 86 H74" className="stroke-pink-200" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <h3 className="font-display text-2xl text-ink-900">{title}</h3>
      {body && <p className="mt-2 max-w-sm text-ink-500">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

import { Card, cn } from '@hb/ui';
import type { ReactNode } from 'react';

const COUNT = new Intl.NumberFormat('en-PK');

export function formatCount(value: number): string {
  return COUNT.format(value);
}

/**
 * One headline count. Render inside a <dl>: the label is the term, the number its description.
 * `size="lg"` for the top-level totals, default for the smaller seller-status tiles.
 */
export function StatCard({
  label,
  value,
  hint,
  badge,
  size = 'md',
}: {
  label: string;
  value: number;
  hint?: string;
  /** Short text flag next to the label (e.g. "Needs review"); never colour alone. */
  badge?: ReactNode;
  size?: 'md' | 'lg';
}) {
  return (
    <Card className={cn('flex flex-col', size === 'lg' ? 'p-6' : 'p-5')}>
      <dt className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium text-ink-500">
        <span>{label}</span>
        {badge}
      </dt>
      <dd
        className={cn(
          'mt-2 font-sans font-semibold leading-none text-ink-900',
          size === 'lg' ? 'text-4xl' : 'text-2xl',
        )}
      >
        {formatCount(value)}
      </dd>
      {hint && <dd className="mt-2 text-xs text-ink-500">{hint}</dd>}
    </Card>
  );
}

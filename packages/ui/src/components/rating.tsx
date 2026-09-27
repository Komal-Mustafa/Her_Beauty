import { Star } from 'lucide-react';
import { cn } from '../lib/cn';

type RatingProps = {
  value: number;
  count?: number;
  /** One star + the number: product cards, where five stars do not fit a 2-column phone grid. */
  compact?: boolean;
  className?: string;
};

/** Gold stars (decorative) + readable text; never colour alone (04-ui-ux §10). */
export function Rating({ value, count, compact = false, className }: RatingProps) {
  const rounded = Math.round(value * 2) / 2;
  if (compact) {
    const reviews = count === undefined ? '' : `, ${count.toLocaleString('en-PK')} reviews`;
    return (
      <span className={cn('inline-flex items-center gap-1 text-sm', className)}>
        <span aria-hidden className="inline-flex items-center gap-1">
          <Star className="h-4 w-4 fill-gold-500 text-gold-500" />
          <span className="text-ink-900">{value.toFixed(1)}</span>
          {count !== undefined && (
            <span className="text-ink-500">({count.toLocaleString('en-PK')})</span>
          )}
        </span>
        <span className="sr-only">
          Rated {value.toFixed(1)} out of 5 stars{reviews}
        </span>
      </span>
    );
  }
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm', className)}>
      <span aria-hidden className="flex">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={cn(
              'h-4 w-4',
              n <= rounded
                ? 'fill-gold-500 text-gold-500'
                : n - 0.5 === rounded
                  ? 'fill-gold-300 text-gold-500'
                  : 'text-ink-200',
            )}
          />
        ))}
      </span>
      <span className="text-ink-900">{value.toFixed(1)}</span>
      {count !== undefined && (
        <span className="text-ink-500">({count.toLocaleString('en-PK')})</span>
      )}
      <span className="sr-only">out of 5 stars</span>
    </span>
  );
}

import { cn } from '@hb/ui';
import { Star } from 'lucide-react';

/**
 * Five gold stars with their meaning as text ("4 out of 5 stars", 04 §10: never by colour or
 * shape alone). For the review cards and the reviews summary, where the number is shown apart.
 */
export function Stars({
  value,
  size = 'sm',
  className,
}: {
  value: number;
  size?: 'sm' | 'lg';
  className?: string;
}) {
  // The icons show half stars; the text keeps the real value to one decimal ("4.8", not "5").
  const rounded = Math.round(value * 2) / 2;
  const shown = String(Math.round(value * 10) / 10);
  return (
    <span className={cn('inline-flex items-center', className)}>
      <span aria-hidden className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={cn(
              size === 'lg' ? 'h-5 w-5' : 'h-4 w-4',
              n <= rounded
                ? 'fill-gold-500 text-gold-500'
                : n - 0.5 === rounded
                  ? 'fill-gold-300 text-gold-500'
                  : 'text-ink-200',
            )}
          />
        ))}
      </span>
      <span className="sr-only">{shown} out of 5 stars</span>
    </span>
  );
}

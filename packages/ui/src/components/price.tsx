import { discountPercent, formatMoney } from '@hb/sdk/format';
import type { Currency, Money } from '@hb/types';
import { cn } from '../lib/cn';

type PriceProps = {
  amount: Money;
  compareAt?: Money | null;
  currency?: Currency;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

/** Price in pink-600, tabular numbers (04-ui-ux §3). Amounts are integer paisa. */
export function Price({
  amount,
  compareAt = null,
  currency = 'PKR',
  size = 'md',
  className,
}: PriceProps) {
  const off = discountPercent(amount, compareAt);
  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-2 tabular-nums', className)}>
      <span
        className={cn(
          'font-semibold text-pink-600',
          size === 'sm' && 'text-base',
          size === 'md' && 'text-lg',
          size === 'lg' && 'text-xl md:text-2xl',
        )}
      >
        {formatMoney(amount, currency)}
      </span>
      {off !== null && compareAt !== null && (
        <>
          <s className="text-sm text-ink-500">
            <span className="sr-only">Was </span>
            {formatMoney(compareAt, currency)}
          </s>
          <span className="text-xs font-medium text-pink-700">−{off}%</span>
        </>
      )}
    </span>
  );
}

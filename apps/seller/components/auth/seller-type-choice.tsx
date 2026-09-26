import type { SellerType } from '@hb/types';
import { cn } from '@hb/ui';
import { CheckCircle2, Crown, ShoppingBag, type LucideIcon } from 'lucide-react';
import { useId, type ChangeEvent, type FocusEvent } from 'react';

type FieldHandlers = {
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
};

type Option = {
  value: SellerType;
  title: string;
  body: string;
  icon: LucideIcon;
  iconClass: string;
  checkedClass: string;
};

const OPTIONS: readonly Option[] = [
  {
    value: 'vendor',
    title: 'Vendor',
    body: 'I sell brands I’m authorised to sell.',
    icon: ShoppingBag,
    iconClass: 'bg-pink-100 text-pink-700',
    checkedClass: 'has-[:checked]:border-pink-600',
  },
  {
    value: 'manufacturer',
    title: 'Manufacturer',
    body: 'I own a brand and sell its products.',
    icon: Crown,
    iconClass: 'bg-blush-50 text-gold-800 ring-1 ring-gold-500',
    checkedClass: 'has-[:checked]:border-gold-500 has-[:checked]:shadow-gold',
  },
];

/**
 * 04-ui-ux §6.5: two big choice cards (Vendor, pink bag / Manufacturer, gold crown). Native
 * radios inside labels, so arrow keys, screen readers and no-JavaScript posts all work; the
 * card shows the focus ring of its hidden radio.
 */
export function SellerTypeChoice({
  defaultValue,
  error,
  field,
  legend = 'How will you sell on Her Beauty?',
}: {
  defaultValue?: string;
  error?: string;
  field?: FieldHandlers;
  legend?: string;
}) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-medium text-ink-900">{legend}</legend>
      {/* Side by side when there is room (container ≥ 24rem), stacked rows on narrow phones. */}
      <div className="mt-2 @container">
        <div className="grid gap-3 @sm:grid-cols-2">
          {OPTIONS.map(({ value, title, body, icon: Icon, iconClass, checkedClass }) => {
            const titleId = `${id}-${value}-title`;
            const bodyId = `${id}-${value}-body`;
            return (
              <label
                key={value}
                className={cn(
                  'group relative flex min-h-11 cursor-pointer items-start gap-3 rounded-card border border-ink-200 bg-white p-4 pr-10 transition-[border-color,box-shadow,background-color] duration-fast motion-reduce:transition-none hover:border-pink-200 has-[:checked]:bg-blush-50 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-pink-400 @sm:min-h-40 @sm:flex-col @sm:gap-2',
                  checkedClass,
                  error && 'border-danger',
                )}
              >
                <input
                  type="radio"
                  name="sellerType"
                  value={value}
                  defaultChecked={defaultValue === value}
                  aria-labelledby={titleId}
                  aria-describedby={[bodyId, errorId].filter(Boolean).join(' ')}
                  aria-invalid={error ? true : undefined}
                  className="sr-only"
                  {...field}
                />
                <span
                  className={cn(
                    'grid h-11 w-11 shrink-0 place-items-center rounded-pill',
                    iconClass,
                  )}
                >
                  <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span id={titleId} className="font-display text-xl font-semibold text-ink-900">
                    {title}
                  </span>
                  <span id={bodyId} className="text-sm leading-snug text-ink-500">
                    {body}
                  </span>
                </span>
                <CheckCircle2
                  aria-hidden
                  className="absolute right-3 top-3 h-5 w-5 text-pink-600 opacity-0 group-has-[:checked]:opacity-100"
                />
              </label>
            );
          })}
        </div>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}

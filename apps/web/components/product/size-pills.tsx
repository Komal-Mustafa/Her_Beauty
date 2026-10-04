'use client';

import type { Variant } from '@hb/types';
import { cn } from '@hb/ui';
import { useId } from 'react';

type SizePillsProps = {
  variants: readonly Variant[];
  value: string;
  onChange: (variantId: string) => void;
};

/**
 * Size choice for products whose variants differ by size instead of shade (docs/p5-catalog.md
 * §5): native radios styled as pills, so arrow keys and form semantics come for free. A sold-out
 * size stays selectable, like a sold-out shade, and says so.
 */
export function SizePills({ variants, value, onChange }: SizePillsProps) {
  const name = useId();
  const selected = variants.find((v) => v.id === value);
  return (
    <fieldset>
      <legend className="mb-2 text-sm text-ink-500">
        Size: <span className="font-medium text-ink-900">{selected?.sizeLabel ?? 'Choose'}</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {variants.map((v) => {
          const soldOut = v.stock <= 0;
          return (
            <label key={v.id} className="relative">
              <input
                type="radio"
                name={name}
                value={v.id}
                checked={v.id === value}
                onChange={() => onChange(v.id)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  'inline-flex min-h-11 cursor-pointer items-center rounded-pill border px-4 text-sm font-medium transition duration-fast ease-soft',
                  'border-ink-200 text-ink-900 hover:border-pink-600',
                  'peer-checked:border-pink-600 peer-checked:bg-pink-100 peer-checked:text-pink-700',
                  'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-pink-400',
                  soldOut && 'text-ink-500 line-through decoration-ink-500',
                )}
              >
                {v.sizeLabel}
                {soldOut ? <span className="sr-only">, sold out</span> : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

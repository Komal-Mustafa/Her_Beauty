'use client';

import { cn } from '@hb/ui';
import { Minus, Plus } from 'lucide-react';
import { useId, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { clampQuantity } from './variant-selection';

type QuantityStepperProps = {
  value: number;
  /** Highest allowed quantity (min(10, stock)); 0 disables the stepper. */
  max: number;
  onChange: (qty: number) => void;
  className?: string;
};

const stepButton =
  'grid h-full w-12 shrink-0 place-items-center text-ink-900 transition duration-fast ease-soft hover:bg-blush-50 hover:text-pink-700 active:scale-95 motion-reduce:active:scale-100 disabled:text-ink-500 disabled:opacity-50 aria-disabled:cursor-default aria-disabled:text-ink-500 aria-disabled:opacity-50 aria-disabled:hover:bg-transparent';

/**
 * Quantity − / + with a labelled input between them (docs/p5-catalog.md §5): 1…max. Typing is
 * allowed; the value settles within range when the field loses focus or on Enter. Arrow Up/Down
 * step it like a native number field. At a limit the button is aria-disabled, not disabled, so
 * keyboard focus stays on it.
 */
export function QuantityStepper({ value, max, onChange, className }: QuantityStepperProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const disabled = max < 1;

  function commit(raw: string) {
    const n = Number.parseInt(raw, 10);
    onChange(clampQuantity(Number.isNaN(n) ? value : n, max));
    setDraft(null);
  }

  function onInput(e: ChangeEvent<HTMLInputElement>) {
    setDraft(e.target.value.replace(/\D/g, '').slice(0, 2));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') commit(e.currentTarget.value);
    const step = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    onChange(clampQuantity(value + step, max));
    setDraft(null);
  }

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-sm text-ink-500">
        Quantity
      </label>
      <div className="inline-flex h-12 items-stretch rounded-btn border border-ink-200 bg-white">
        <button
          type="button"
          aria-label="Decrease quantity"
          aria-controls={id}
          disabled={disabled}
          aria-disabled={value <= 1 || undefined}
          onClick={() => onChange(clampQuantity(value - 1, max))}
          className={cn(stepButton, 'rounded-l-btn')}
        >
          <Minus aria-hidden className="h-4 w-4" />
        </button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          aria-describedby={disabled ? undefined : `${id}-hint`}
          disabled={disabled}
          value={draft ?? String(value)}
          onChange={onInput}
          onBlur={(e) => commit(e.currentTarget.value)}
          onKeyDown={onKeyDown}
          className="w-12 border-x border-ink-200 bg-transparent text-center text-[15px] font-medium tabular-nums text-ink-900 focus-visible:outline-offset-0 disabled:text-ink-500"
        />
        <button
          type="button"
          aria-label="Increase quantity"
          aria-controls={id}
          disabled={disabled}
          aria-disabled={value >= max || undefined}
          onClick={() => onChange(clampQuantity(value + 1, max))}
          className={cn(stepButton, 'rounded-r-btn')}
        >
          <Plus aria-hidden className="h-4 w-4" />
        </button>
      </div>
      {disabled ? null : (
        <p id={`${id}-hint`} className="sr-only">
          From 1 to {max}
        </p>
      )}
    </div>
  );
}

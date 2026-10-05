'use client';

import type { FacetOption, ShadeFacetOption } from '@hb/types';
import { cn } from '@hb/ui';
import { Check, ChevronDown } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { productCount } from '@/lib/listing-url';

type FilterGroupProps = {
  legend: string;
  children: ReactNode;
  className?: string;
};

/**
 * One filter group (docs/p5-catalog.md §2.1, §9): a fieldset whose legend is a disclosure button,
 * so the group keeps its name for assistive tech and can be folded away. Open by default.
 */
export function FilterGroup({ legend, children, className }: FilterGroupProps) {
  const [open, setOpen] = useState(true);
  const contentId = useId();
  return (
    <fieldset
      className={cn('min-w-0 border-t border-ink-200 py-3 first-of-type:border-t-0', className)}
    >
      <legend className="w-full">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-btn text-left text-[15px] font-semibold text-ink-900 transition-colors duration-fast hover:text-pink-700"
        >
          {legend}
          <ChevronDown
            aria-hidden
            className={cn(
              'h-4 w-4 shrink-0 text-gold-600 transition-transform duration-base ease-soft motion-reduce:transition-none',
              open && 'rotate-180',
            )}
          />
        </button>
      </legend>
      <div id={contentId} hidden={!open} className="pt-1">
        {children}
      </div>
    </fieldset>
  );
}

/** "Glow" with its count; the count is read as ", 6 products" (docs/p5-catalog.md §9). */
function OptionText({ option }: { option: FacetOption }) {
  return (
    <>
      <span className="min-w-0 flex-1 text-sm text-ink-900">{option.label}</span>
      <span aria-hidden className="text-xs tabular-nums text-ink-500">
        {option.count.toLocaleString('en-PK')}
      </span>
      <span className="sr-only">, {productCount(option.count)}</span>
    </>
  );
}

const rowClass =
  'flex min-h-11 cursor-pointer items-center gap-3 rounded-btn px-2 transition-colors duration-fast hover:bg-blush-50';
const boxClass = 'h-5 w-5 shrink-0 cursor-pointer accent-pink-600';

/** Options worth showing: a count above 0, or ticked (so it can be unticked). */
export function visibleOptions<T extends FacetOption>(
  options: readonly T[],
  isSelected: (value: string) => boolean,
): T[] {
  return options.filter((o) => o.count > 0 || isSelected(o.value));
}

type CheckboxListProps = {
  name: string;
  options: readonly FacetOption[];
  selected: readonly string[];
  onToggle: (value: string) => void;
  /** Show this many, then a "Show all {n}" button (selected options always show). */
  limit?: number;
  /** "brands" in "Show all 12 brands". */
  noun?: string;
};

/** Checkboxes with counts; long lists fold after `limit` options. */
export function CheckboxList({
  name,
  options,
  selected,
  onToggle,
  limit,
  noun,
}: CheckboxListProps) {
  const [all, setAll] = useState(false);
  const listId = useId();
  const folds = limit !== undefined && options.length > limit;
  const shown =
    folds && !all ? options.filter((o, i) => i < limit || selected.includes(o.value)) : options;
  return (
    <>
      <ul id={listId} className="flex flex-col">
        {shown.map((o) => (
          <li key={o.value}>
            <label className={rowClass}>
              <input
                type="checkbox"
                name={name}
                value={o.value}
                checked={selected.includes(o.value)}
                onChange={() => onToggle(o.value)}
                className={boxClass}
              />
              <OptionText option={o} />
            </label>
          </li>
        ))}
      </ul>
      {folds ? (
        <button
          type="button"
          aria-expanded={all}
          aria-controls={listId}
          onClick={() => setAll((a) => !a)}
          className="mt-1 inline-flex min-h-11 items-center rounded-btn px-2 text-sm font-medium text-pink-600 underline-offset-4 hover:text-pink-700 hover:underline"
        >
          {all ? 'Show fewer' : `Show all ${options.length} ${noun ?? ''}`.trim()}
        </button>
      ) : null}
    </>
  );
}

type RadioListProps = {
  name: string;
  /** The first option, for no filter ("All categories", "Any rating"). */
  anyLabel: string;
  options: readonly FacetOption[];
  selected: string | undefined;
  onSelect: (value: string | undefined) => void;
  /** Visible label per option, e.g. "4★ & up" (the option's own label is still read out). */
  display?: (option: FacetOption) => ReactNode;
};

/** A single choice with counts, plus a first "any" option that removes the filter. */
export function RadioList({
  name,
  anyLabel,
  options,
  selected,
  onSelect,
  display,
}: RadioListProps) {
  return (
    <ul className="flex flex-col">
      <li>
        <label className={rowClass}>
          <input
            type="radio"
            name={name}
            value=""
            checked={selected === undefined}
            onChange={() => onSelect(undefined)}
            className={boxClass}
          />
          <span className="min-w-0 flex-1 text-sm text-ink-900">{anyLabel}</span>
        </label>
      </li>
      {options.map((o) => (
        <li key={o.value}>
          <label className={rowClass}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={selected === o.value}
              onChange={() => onSelect(o.value)}
              className={boxClass}
            />
            {display ? (
              <>
                <span aria-hidden className="min-w-0 flex-1 text-sm text-ink-900">
                  {display(o)}
                </span>
                <span aria-hidden className="text-xs tabular-nums text-ink-500">
                  {o.count.toLocaleString('en-PK')}
                </span>
                <span className="sr-only">
                  {o.label}, {productCount(o.count)}
                </span>
              </>
            ) : (
              <OptionText option={o} />
            )}
          </label>
        </li>
      ))}
    </ul>
  );
}

type ShadeSwatchesProps = {
  options: readonly ShadeFacetOption[];
  selected: readonly string[];
  onToggle: (value: string) => void;
};

/**
 * Shade families as round swatches of the family colour with the name underneath. Each is a real
 * checkbox (visually hidden); ticked = gold ring and a check mark, so it never relies on colour.
 */
export function ShadeSwatches({ options, selected, onToggle }: ShadeSwatchesProps) {
  return (
    <ul className="grid grid-cols-4 gap-x-1 gap-y-2">
      {options.map((o) => (
        <li key={o.value}>
          <label className="flex min-h-11 cursor-pointer flex-col items-center gap-1.5 rounded-btn px-0.5 py-1.5 text-center transition-colors duration-fast hover:bg-blush-50">
            <input
              type="checkbox"
              name="shade"
              value={o.value}
              checked={selected.includes(o.value)}
              onChange={() => onToggle(o.value)}
              className="peer sr-only"
            />
            <span
              aria-hidden
              // The swatch colour is data (the family's display hex from the API), not a style token.
              style={{ backgroundColor: o.hex }}
              className="grid h-8 w-8 place-items-center rounded-pill shadow-soft ring-1 ring-ink-200 ring-offset-2 ring-offset-white transition-[box-shadow] duration-fast peer-checked:ring-2 peer-checked:ring-gold-500 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-pink-400 [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100"
            >
              <Check className="h-4 w-4 text-white drop-shadow-sm transition-opacity duration-fast" />
            </span>
            <span aria-hidden className="text-xs leading-tight text-ink-900">
              {o.label}
              <span className="block tabular-nums text-ink-500">
                {o.count.toLocaleString('en-PK')}
              </span>
            </span>
            <span className="sr-only">
              {o.label}, {productCount(o.count)}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}

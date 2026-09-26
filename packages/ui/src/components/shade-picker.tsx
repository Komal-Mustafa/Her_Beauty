'use client';

import * as Tooltip from '@radix-ui/react-tooltip';
import { useRef, type KeyboardEvent } from 'react';
import { cn } from '../lib/cn';

export type Shade = { name: string; hex: string; soldOut?: boolean };

type ShadePickerProps = {
  shades: Shade[];
  value: string;
  onChange: (name: string) => void;
  label?: string;
};

/**
 * 04-ui-ux §5: 28px circles with hex fill; selected = 2px gold ring + name tooltip.
 * Radio-group semantics with arrow-key navigation.
 */
export function ShadePicker({ shades, value, onChange, label = 'Shade' }: ShadePickerProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = shades.find((s) => s.name === value);

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const delta =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + shades.length) % shades.length;
    const shade = shades[next];
    if (shade) {
      onChange(shade.name);
      refs.current[next]?.focus();
    }
  }

  return (
    <Tooltip.Provider delayDuration={150}>
      <div>
        <p className="mb-2 text-sm text-ink-500">
          {label}: <span className="font-medium text-ink-900">{selected?.name ?? 'Choose'}</span>
        </p>
        <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-3">
          {shades.map((shade, i) => {
            const isSelected = shade.name === value;
            return (
              <Tooltip.Root key={shade.name}>
                <Tooltip.Trigger asChild>
                  <button
                    ref={(el) => {
                      refs.current[i] = el;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={`${shade.name}${shade.soldOut ? ', sold out' : ''}`}
                    tabIndex={isSelected || (!selected && i === 0) ? 0 : -1}
                    onClick={() => onChange(shade.name)}
                    onKeyDown={(e) => onKeyDown(e, i)}
                    className={cn(
                      'relative grid h-11 w-11 place-items-center rounded-pill transition duration-fast',
                      isSelected ? 'ring-2 ring-gold-500 ring-offset-2' : 'hover:scale-110',
                    )}
                  >
                    {/* Shade colours are product data (variant.shade_hex), not UI tokens. */}
                    <span
                      className="block h-7 w-7 rounded-pill border border-ink-200"
                      style={{ backgroundColor: shade.hex }}
                    />
                    {shade.soldOut && (
                      <span aria-hidden className="absolute h-0.5 w-8 rotate-45 bg-ink-500" />
                    )}
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    sideOffset={6}
                    className="z-50 rounded-btn bg-ink-900 px-2.5 py-1 text-xs text-white data-[state=delayed-open]:animate-fade"
                  >
                    {shade.name}
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            );
          })}
        </div>
      </div>
    </Tooltip.Provider>
  );
}

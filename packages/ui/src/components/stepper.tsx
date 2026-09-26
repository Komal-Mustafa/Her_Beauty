import { Check } from 'lucide-react';
import { cn } from '../lib/cn';

export type StepperStep = { id: string; label: string };

type StepperProps = {
  steps: StepperStep[];
  /** Index of the current step; earlier steps are done. */
  current: number;
  /** 'order' = tracker (pulsing current step), 'wizard' = gold progress bar. */
  variant?: 'order' | 'wizard';
  className?: string;
};

/** 04-ui-ux §5 order stepper: done pink-600, current pulsing pink-400, next ink-200. */
export function Stepper({ steps, current, variant = 'order', className }: StepperProps) {
  if (variant === 'wizard') {
    const pct = steps.length > 1 ? (current / (steps.length - 1)) * 100 : 100;
    const step = steps[current];
    return (
      <div className={cn('w-full', className)}>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-ink-900">{step?.label}</span>
          <span className="text-ink-500">
            Step {current + 1} of {steps.length}
          </span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-pill bg-ink-200"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={current + 1}
          aria-label="Registration progress"
        >
          <div
            className="h-full origin-left bg-grad-gold transition-[width] duration-slow ease-soft"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <ol className={cn('flex w-full items-start', className)}>
      {steps.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'next';
        return (
          <li
            key={s.id}
            className="relative flex flex-1 flex-col items-center text-center"
            aria-current={state === 'current' ? 'step' : undefined}
          >
            {i > 0 && (
              <span
                aria-hidden
                className={cn(
                  'absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2',
                  i <= current ? 'bg-pink-600' : 'bg-ink-200',
                )}
              />
            )}
            <span
              className={cn(
                'relative z-10 grid h-8 w-8 place-items-center rounded-pill border-2 bg-white text-xs font-semibold',
                state === 'done' && 'border-pink-600 bg-pink-600 text-white',
                state === 'current' && 'border-pink-400 text-pink-700',
                state === 'next' && 'border-ink-200 text-ink-500',
              )}
            >
              {state === 'current' && (
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-pill bg-pink-400/30 animate-pulse-soft"
                />
              )}
              {state === 'done' ? <Check aria-hidden className="h-4 w-4" /> : i + 1}
            </span>
            <span
              className={cn(
                'mt-2 text-xs sm:text-sm',
                state === 'next' ? 'text-ink-500' : 'text-ink-900',
              )}
            >
              {s.label}
              <span className="sr-only">
                {state === 'done' ? ' (done)' : state === 'current' ? ' (current)' : ''}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

'use client';

import {
  forwardRef,
  useId,
  useRef,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '../lib/cn';
import { fieldClass, fieldErrorClass } from './field-styles';

type CodeInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'maxLength'
> & {
  label: string;
  hint?: ReactNode;
  error?: string;
  /** Number of digits (default 6). */
  length?: number;
  /** Called with the digits only, after every change. */
  onValueChange?: (code: string) => void;
  /** Called once all digits are entered (typed, pasted or autofilled from SMS). */
  onComplete?: (code: string) => void;
};

/**
 * One-time code field: a single uncontrolled input (works with SMS autofill, paste, screen
 * readers, form reset and without JavaScript), digits only, spaced out for easy reading.
 */
export const CodeInput = forwardRef<HTMLInputElement, CodeInputProps>(function CodeInput(
  {
    label,
    hint,
    error,
    length = 6,
    onValueChange,
    onComplete,
    onChange,
    className,
    id,
    required,
    ...props
  },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const completed = useRef<string | null>(null);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const digits = input.value.replace(/\D/g, '').slice(0, length);
    if (input.value !== digits) input.value = digits;
    onChange?.(e);
    onValueChange?.(digits);
    if (digits.length === length && completed.current !== digits) {
      completed.current = digits;
      onComplete?.(digits);
    } else if (digits.length < length) {
      completed.current = null;
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-ink-900">
        {label}
        {required && <span className="text-pink-600"> *</span>}
      </label>
      <input
        ref={ref}
        id={inputId}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        required={required}
        onChange={handleChange}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        className={cn(
          fieldClass,
          'h-14 max-w-[16rem] pl-[calc(1rem+0.5em)] text-center text-2xl font-medium tracking-[0.5em] tabular-nums',
          error && fieldErrorClass,
          className,
        )}
        {...props}
      />
      {hint && !error && (
        <p id={hintId} className="text-xs text-ink-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
});

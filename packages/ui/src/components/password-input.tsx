'use client';

import { Eye, EyeOff } from 'lucide-react';
import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { fieldClass, fieldErrorClass } from './field-styles';

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  /** Always visible above the field (04-ui-ux §5, §10). */
  label: string;
  hint?: ReactNode;
  error?: string;
};

/**
 * Password field with a show/hide toggle. Without JavaScript it is a plain password field.
 * The toggle is a real button (aria-pressed) so keyboard and screen-reader users can use it.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ label, hint, error, className, id, required, ...props }, ref) {
    const autoId = useId();
    const inputId = id ?? autoId;
    const hintId = hint ? `${inputId}-hint` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;
    const [visible, setVisible] = useState(false);
    const Icon = visible ? EyeOff : Eye;
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-ink-900">
          {label}
          {required && <span className="text-pink-600"> *</span>}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={visible ? 'text' : 'password'}
            required={required}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
            className={cn(fieldClass, 'pr-12', error && fieldErrorClass, className)}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-pressed={visible}
            aria-controls={inputId}
            aria-label="Show password"
            title={visible ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-1 my-auto grid h-10 w-10 place-items-center rounded-btn text-ink-500 transition duration-fast hover:bg-blush-50 hover:text-ink-900"
          >
            <Icon aria-hidden className="h-5 w-5" />
          </button>
        </div>
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
  },
);

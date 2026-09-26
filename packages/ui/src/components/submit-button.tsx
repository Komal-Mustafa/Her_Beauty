'use client';

import { LoaderCircle } from 'lucide-react';
import { forwardRef, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { Button, type ButtonProps } from './button';

type SubmitButtonProps = Omit<ButtonProps, 'type' | 'asChild'> & {
  /** Label while the form's action runs, e.g. "Logging in…". */
  pendingLabel?: ReactNode;
};

/** Submit button that shows progress and blocks double submits while its form's action runs. */
export const SubmitButton = forwardRef<HTMLButtonElement, SubmitButtonProps>(function SubmitButton(
  { children, pendingLabel, disabled, ...props },
  ref,
) {
  const { pending } = useFormStatus();
  return (
    <Button
      ref={ref}
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending && <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" />}
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  );
});

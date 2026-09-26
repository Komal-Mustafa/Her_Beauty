import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FormAlert } from '../components/form-alert';
import { optionalField, type FieldCheck, type FieldErrorMap } from '../lib/field-checks';
import { useFieldErrors } from './use-field-errors';

afterEach(cleanup);

const required =
  (message: string): FieldCheck =>
  (value) =>
    value.trim() ? undefined : message;

function needsEmailOrPhone(form: HTMLFormElement): FieldErrorMap {
  const value = (name: string) => {
    const el = form.elements.namedItem(name);
    return el instanceof HTMLInputElement ? el.value.trim() : '';
  };
  return value('email') || value('phone') ? {} : { email: 'Add an email or a mobile number.' };
}

/** The shop's register form shape: a cross-field check on a field below the first one. */
function RegisterLike() {
  const v = useFieldErrors(
    {
      fullName: required('Enter your name.'),
      email: optionalField(required('Enter an email.')),
      phone: optionalField(required('Enter a mobile number.')),
      password: required('Enter a password.'),
    },
    null,
    { formCheck: needsEmailOrPhone },
  );
  return (
    <form onSubmit={v.onSubmit} noValidate aria-label="register">
      {['fullName', 'email', 'phone', 'password'].map((name) => (
        <div key={name}>
          <input
            name={name}
            aria-label={name}
            aria-invalid={Boolean(v.errorFor(name))}
            {...v.field}
          />
          {v.errorFor(name) && <span>{v.errorFor(name)}</span>}
        </div>
      ))}
      <button type="submit">Create account</button>
    </form>
  );
}

describe('useFieldErrors', () => {
  it('focuses the first invalid field in reading order, not the first error found', () => {
    render(<RegisterLike />);
    fireEvent.submit(screen.getByRole('form', { name: 'register' }));
    expect(document.activeElement).toBe(screen.getByLabelText('fullName'));
    expect(screen.getByText('Enter your name.')).toBeTruthy();
    expect(screen.getByText('Add an email or a mobile number.')).toBeTruthy();
  });

  it('moves on to the next invalid field once the first is fixed', () => {
    render(<RegisterLike />);
    fireEvent.change(screen.getByLabelText('fullName'), { target: { value: 'Ayesha' } });
    fireEvent.submit(screen.getByRole('form', { name: 'register' }));
    expect(document.activeElement).toBe(screen.getByLabelText('email'));
  });

  it('checks on blur only after something was typed', () => {
    render(<RegisterLike />);
    const name = screen.getByLabelText('fullName');
    fireEvent.blur(name);
    expect(screen.queryByText('Enter your name.')).toBeNull();
    fireEvent.change(name, { target: { value: ' ' } });
    fireEvent.blur(name);
    expect(screen.getByText('Enter your name.')).toBeTruthy();
  });
});

describe('FormAlert', () => {
  it('shows only error states, as an assertive alert', () => {
    const { rerender } = render(<FormAlert state={{ status: 'ok' }} />);
    expect(screen.queryByRole('alert')).toBeNull();
    rerender(<FormAlert state={{ status: 'error', message: 'Try again in a moment.' }} />);
    expect(screen.getByRole('alert').textContent).toContain('Try again in a moment.');
  });
});

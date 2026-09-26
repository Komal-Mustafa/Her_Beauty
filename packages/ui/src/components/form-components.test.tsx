import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Alert } from './alert';
import { CodeInput } from './code-input';
import { PasswordInput } from './password-input';
import { SubmitButton } from './submit-button';
import { Tabs } from './tabs';

afterEach(cleanup);

describe('PasswordInput', () => {
  it('toggles visibility with a labelled, pressable button', () => {
    render(<PasswordInput label="Password" name="password" />);
    const input = screen.getByLabelText('Password', { selector: 'input' });
    const toggle = screen.getByRole('button', { name: 'Show password' });
    expect(input.getAttribute('type')).toBe('password');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle);
    expect(input.getAttribute('type')).toBe('text');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });

  it('links the error message to the field', () => {
    render(<PasswordInput label="Password" error="Enter your password." />);
    const input = screen.getByLabelText('Password', { selector: 'input' });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(describedBy)?.textContent).toBe('Enter your password.');
  });
});

describe('CodeInput', () => {
  it('keeps digits only and reports completion once', () => {
    const onComplete = vi.fn();
    render(<CodeInput label="Code" name="code" onComplete={onComplete} />);
    const input = screen.getByLabelText('Code') as HTMLInputElement;
    expect(input.getAttribute('autocomplete')).toBe('one-time-code');
    expect(input.getAttribute('inputmode')).toBe('numeric');
    fireEvent.change(input, { target: { value: '12 3-45' } });
    expect(input.value).toBe('12345');
    expect(onComplete).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '123 4567' } });
    expect(input.value).toBe('123456');
    expect(onComplete).toHaveBeenCalledWith('123456');
  });
});

describe('Tabs', () => {
  const items = [
    { id: 'password', label: 'Password', content: <p>password panel</p> },
    { id: 'otp', label: 'Mobile code', href: '?method=otp', content: <p>otp panel</p> },
  ];

  it('shows one panel and moves with the arrow keys', () => {
    render(<Tabs label="Log in with" items={items} />);
    const first = screen.getByRole('tab', { name: 'Password' });
    expect(first.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('otp panel').closest('[role="tabpanel"]')?.hasAttribute('hidden')).toBe(
      true,
    );
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    const second = screen.getByRole('tab', { name: 'Mobile code' });
    expect(second.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(second);
    expect(window.location.search).toBe('?method=otp');
  });

  it('renders link tabs so the switch works without JavaScript', () => {
    render(<Tabs label="Log in with" items={items} defaultValue="otp" />);
    const tab = screen.getByRole('tab', { name: 'Mobile code' });
    expect(tab.tagName).toBe('A');
    expect(tab.getAttribute('href')).toBe('?method=otp');
    expect(tab.getAttribute('aria-selected')).toBe('true');
  });
});

describe('Alert', () => {
  it('announces danger alerts assertively and others politely', () => {
    render(
      <>
        <Alert tone="danger" title="Couldn’t log in" />
        <Alert tone="success">Saved</Alert>
      </>,
    );
    expect(screen.getByRole('alert').textContent).toContain('Couldn’t log in');
    expect(screen.getByRole('status').textContent).toContain('Saved');
  });
});

describe('SubmitButton', () => {
  it('is a submit button', () => {
    render(
      <form>
        <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
      </form>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.getAttribute('type')).toBe('submit');
    expect(button.hasAttribute('disabled')).toBe(false);
  });
});

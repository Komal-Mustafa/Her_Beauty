// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { QuantityStepper } from './quantity-stepper';

function Harness({ max, start = 1 }: { max: number; start?: number }) {
  const [qty, setQty] = useState(start);
  return <QuantityStepper value={qty} max={max} onChange={setQty} />;
}

const input = () => screen.getByLabelText('Quantity') as HTMLInputElement;
const minus = () => screen.getByRole('button', { name: 'Decrease quantity' });
const plus = () => screen.getByRole('button', { name: 'Increase quantity' });

describe('QuantityStepper', () => {
  afterEach(cleanup);

  it('is a labelled field with its range described', () => {
    render(<Harness max={3} />);
    expect(input().value).toBe('1');
    expect(input().getAttribute('inputmode')).toBe('numeric');
    const hint = document.getElementById(input().getAttribute('aria-describedby') ?? '');
    expect(hint?.textContent).toBe('From 1 to 3');
  });

  it('steps within 1…max and marks the limits without losing focus', () => {
    render(<Harness max={3} />);
    expect(minus().getAttribute('aria-disabled')).toBe('true');
    // aria-disabled, not disabled: the button stays focusable at the limit.
    expect((minus() as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(minus());
    expect(input().value).toBe('1');

    fireEvent.click(plus());
    fireEvent.click(plus());
    fireEvent.click(plus());
    expect(input().value).toBe('3');
    expect(plus().getAttribute('aria-disabled')).toBe('true');
    expect(minus().hasAttribute('aria-disabled')).toBe(false);
  });

  it('settles a typed value within range on blur or Enter', () => {
    render(<Harness max={10} />);
    fireEvent.change(input(), { target: { value: '25' } });
    expect(input().value).toBe('25');
    fireEvent.blur(input());
    expect(input().value).toBe('10');

    fireEvent.change(input(), { target: { value: '0' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(input().value).toBe('1');
  });

  it('keeps digits only and restores the value when the field is emptied', () => {
    render(<Harness max={10} start={4} />);
    fireEvent.change(input(), { target: { value: '7a!' } });
    expect(input().value).toBe('7');
    fireEvent.change(input(), { target: { value: '' } });
    fireEvent.blur(input());
    expect(input().value).toBe('4');
  });

  it('steps with the arrow keys like a number field', () => {
    render(<Harness max={2} />);
    fireEvent.keyDown(input(), { key: 'ArrowUp' });
    fireEvent.keyDown(input(), { key: 'ArrowUp' });
    expect(input().value).toBe('2');
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    expect(input().value).toBe('1');
  });

  it('is disabled when nothing can be added', () => {
    render(<Harness max={0} />);
    expect(input().disabled).toBe(true);
    expect((minus() as HTMLButtonElement).disabled).toBe(true);
    expect((plus() as HTMLButtonElement).disabled).toBe(true);
    expect(input().hasAttribute('aria-describedby')).toBe(false);
  });
});

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Badge } from './badge';
import { Price } from './price';
import { ShadePicker } from './shade-picker';
import { Stepper } from './stepper';

afterEach(cleanup);

describe('Price', () => {
  it('formats paisa and shows the discount', () => {
    render(<Price amount={185000} compareAt={220000} />);
    expect(screen.getByText('Rs 1,850')).toBeTruthy();
    expect(screen.getByText('−16%')).toBeTruthy();
  });
});

describe('Badge', () => {
  it('always labels sponsored content', () => {
    render(<Badge kind="sponsored" />);
    expect(screen.getByText('Sponsored')).toBeTruthy();
  });
});

describe('Stepper', () => {
  it('marks the current step for assistive tech', () => {
    render(
      <Stepper
        current={1}
        steps={[
          { id: 'paid', label: 'Paid' },
          { id: 'accepted', label: 'Accepted' },
          { id: 'shipped', label: 'Shipped' },
        ]}
      />,
    );
    const current = screen.getByText('Accepted').closest('li');
    expect(current?.getAttribute('aria-current')).toBe('step');
  });
});

describe('ShadePicker', () => {
  it('moves selection with arrow keys', () => {
    const onChange = vi.fn();
    render(
      <ShadePicker
        value="Rose"
        onChange={onChange}
        shades={[
          { name: 'Rose', hex: '#C2185B' },
          { name: 'Nude', hex: '#C98A7A' },
        ]}
      />,
    );
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Rose' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('Nude');
  });
});

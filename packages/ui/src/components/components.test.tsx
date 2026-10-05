import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Badge } from './badge';
import { Price } from './price';
import { ShadePicker } from './shade-picker';
import { Stepper } from './stepper';

afterEach(cleanup);

describe('Price', () => {
  it('formats paisa and shows the discount, rounded down like the discount sort', () => {
    render(<Price amount={185000} compareAt={220000} />);
    expect(screen.getByText('Rs 1,850')).toBeTruthy();
    expect(screen.getByText('−15%')).toBeTruthy(); // 15.9 %
  });
});

// Brand tokens straight from the Tailwind theme the apps build with.
const THEME = readFileSync(resolve(process.cwd(), '../config/tailwind/theme.css'), 'utf8');
const TOKENS = new Map(
  [...THEME.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1], m[2]]),
);

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

/** The colour behind a `text-*` / `bg-*` utility (opacity suffix ignored). */
function tokenOf(className: string, prefix: 'text' | 'bg'): string {
  for (const cls of className.split(/\s+/)) {
    if (!cls.startsWith(`${prefix}-`)) continue;
    const hex = TOKENS.get(cls.slice(prefix.length + 1).split('/')[0] ?? '');
    if (hex) return hex;
  }
  throw new Error(`no ${prefix} colour token in "${className}"`);
}

describe('Badge', () => {
  it('always labels sponsored content', () => {
    render(<Badge kind="sponsored" />);
    expect(screen.getByText('Sponsored')).toBeTruthy();
  });

  // 12 px text needs 4.5:1 (WCAG 2.1 AA, rules.md §7). B2 shows 2FA On/Off, Verified and
  // This device with these badges.
  it.each([
    'success',
    'warning',
    'danger',
    'info',
    'verified',
    'official',
    'sponsored',
    'sale',
    'new',
  ] as const)('%s text meets AA contrast', (kind) => {
    render(<Badge kind={kind}>State</Badge>);
    const badge = screen.getByText('State');
    const ratio = contrast(tokenOf(badge.className, 'text'), tokenOf(badge.className, 'bg'));
    expect(ratio).toBeGreaterThanOrEqual(4.5);
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

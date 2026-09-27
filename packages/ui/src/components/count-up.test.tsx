import { act, cleanup, render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cubicBezier, easeSoft } from '../lib/ease';
import { CountUp } from './count-up';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

type ObserverCallback = (entries: { isIntersecting: boolean }[]) => void;
let observers: ObserverCallback[] = [];
let frames: FrameRequestCallback[] = [];

function stubBrowser({ reduce = false } = {}) {
  observers = [];
  frames = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: ObserverCallback) {
        observers.push(cb);
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: reduce && q.includes('reduce'),
    addEventListener() {},
    removeEventListener() {},
  }));
}

const visual = (c: HTMLElement) => c.querySelectorAll('span > span')[1]?.textContent;
const spoken = (c: HTMLElement) => c.querySelector('.sr-only')?.textContent;

function runFrames(until: number) {
  vi.spyOn(performance, 'now').mockReturnValue(0);
  act(() => {
    while (frames.length) frames.shift()?.(until);
  });
}

describe('CountUp', () => {
  beforeEach(() => stubBrowser());

  it('renders the final value on the server', () => {
    const html = renderToString(<CountUp value={12480} suffix="+" />);
    expect(html).toContain('12,480+');
  });

  it('resets off-screen, counts once visible, and ends on the exact value', () => {
    const { container } = render(<CountUp value={12480} />);
    expect(spoken(container)).toBe('12,480');
    act(() => observers[0]?.([{ isIntersecting: false }]));
    expect(visual(container)).toBe('0');
    act(() => observers[0]?.([{ isIntersecting: true }]));
    runFrames(5000);
    expect(visual(container)).toBe('12,480');
    // Screen readers only ever get the final value.
    expect(spoken(container)).toBe('12,480');
  });

  it('keeps the final value when already on screen at load', () => {
    const { container } = render(<CountUp value={42} />);
    act(() => observers[0]?.([{ isIntersecting: true }]));
    expect(visual(container)).toBe('42');
    expect(frames).toHaveLength(0);
  });

  it('shows the final value at once under reduced motion', () => {
    stubBrowser({ reduce: true });
    const { container } = render(<CountUp value={980} />);
    expect(observers).toHaveLength(0);
    expect(visual(container)).toBe('980');
  });

  it('reserves the final width with an invisible copy (no layout shift)', () => {
    const { container } = render(<CountUp value={12480} />);
    const ghost = container.querySelector('.invisible');
    expect(ghost?.textContent).toBe('12,480');
    expect(ghost?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('ease-soft', () => {
  it('matches the CSS curve end points and is monotonic', () => {
    expect(easeSoft(0)).toBe(0);
    expect(easeSoft(1)).toBe(1);
    let prev = 0;
    for (let t = 0.05; t < 1; t += 0.05) {
      const v = easeSoft(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    // ease-out: well ahead of linear early on.
    expect(easeSoft(0.25)).toBeGreaterThan(0.5);
  });

  it('is the identity for a linear bezier', () => {
    const linear = cubicBezier(0, 0, 1, 1);
    expect(linear(0.3)).toBeCloseTo(0.3, 5);
  });
});

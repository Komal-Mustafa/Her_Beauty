import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Marquee } from './marquee';

afterEach(cleanup);

function renderMarquee(props: Partial<Parameters<typeof Marquee>[0]> = {}) {
  return render(
    <Marquee label="Official brands" {...props}>
      {['Glow', 'Velvet', 'Dewy', 'Luxe'].map((name) => (
        <a key={name} href={`/brand/${name.toLowerCase()}`}>
          {name}
        </a>
      ))}
    </Marquee>,
  );
}

describe('Marquee', () => {
  it('exposes one labelled list to assistive tech', () => {
    renderMarquee();
    const list = screen.getByRole('list', { name: 'Official brands' });
    expect(list.querySelectorAll('li')).toHaveLength(4);
    // The copies that make the loop are hidden and cannot be focused.
    expect(screen.getAllByRole('link')).toHaveLength(4);
  });

  it('marks every repeated copy aria-hidden and inert', () => {
    const { container } = renderMarquee();
    const copies = container.querySelectorAll('ul[aria-hidden="true"]');
    // The one hung off the left edge, then at least one after the list.
    expect(copies.length).toBeGreaterThanOrEqual(2);
    copies.forEach((ul) => expect(ul.hasAttribute('inert')).toBe(true));
  });

  it('collapses to one static wrapped row under reduced motion (CSS, so it holds before JS)', () => {
    const { container } = renderMarquee();
    const list = screen.getByRole('list', { name: 'Official brands' });
    expect(list.className).toContain('motion-reduce:flex-wrap');
    container
      .querySelectorAll('ul[aria-hidden="true"]')
      .forEach((ul) => expect(ul.className).toContain('motion-reduce:hidden'));
  });

  it('has a Pause/Play button', () => {
    renderMarquee({ pauseLabel: 'Pause brand logos', playLabel: 'Play brand logos' });
    fireEvent.click(screen.getByRole('button', { name: 'Pause brand logos' }));
    expect(screen.getByRole('button', { name: 'Play brand logos' })).toBeTruthy();
  });

  it('can drop the button', () => {
    renderMarquee({ pauseButton: false });
    expect(screen.queryByRole('button')).toBeNull();
  });
});

/*
 * The loop, with the layout jsdom lacks: a 1000 px strip and four 200 px items every 250 px, so
 * one copy is 1000 px. The edge fade is 8 % (80 px); a focus ring reaches 4 px outside its item.
 */
const WIDTH = 1000;
const STRIDE = 250;
const ITEM = 200;
const DISTANCE = 4 * STRIDE;
const FADE = 0.08 * WIDTH;
const RING = 4;

type FakeAnimation = {
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  currentTime: number;
  paused: boolean;
  pause: () => void;
  play: () => void;
  cancel: () => void;
};

describe('Marquee loop', () => {
  let animations: FakeAnimation[];
  let observers: IntersectionObserverCallback[];
  let focusVisible: boolean;

  const loop = () => {
    const animation = animations.at(-1);
    if (!animation) throw new Error('no animation started');
    return animation;
  };

  /** Where the track's origin (the start of the original list) is drawn right now. */
  function translateX(a: FakeAnimation): number {
    const x = (i: number) => Number.parseFloat(String(a.keyframes[i]?.transform).slice(11));
    const duration = Number(a.options.duration);
    const f = (a.currentTime % duration) / duration;
    return x(0) + f * (x(1) - x(0));
  }

  /** Left edge of item `i` of the original list, in px from the strip's left edge. */
  const itemLeft = (i: number) => translateX(loop()) + i * STRIDE;

  const link = (name: string) => screen.getByRole('link', { name });
  const strip = () => {
    const viewport = screen.getByRole('list', { name: 'Official brands' }).parentElement
      ?.parentElement;
    if (!viewport) throw new Error('no strip');
    return viewport;
  };

  beforeEach(() => {
    animations = [];
    observers = [];
    focusVisible = true;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IntersectionObserverCallback) {
          observers.push(cb);
        }
        observe() {}
        disconnect() {}
      },
    );
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      writable: true,
      value(keyframes: Keyframe[], options: KeyframeAnimationOptions) {
        const animation: FakeAnimation = {
          keyframes,
          options,
          currentTime: 0,
          paused: false,
          pause: () => void (animation.paused = true),
          play: () => void (animation.paused = false),
          cancel: () => {},
        };
        animations.push(animation);
        return animation;
      },
    });
    // Every copy of the list is one loop wide.
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.tagName === 'UL' ? DISTANCE : 0;
    });
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(WIDTH);
    const matches = Element.prototype.matches;
    vi.spyOn(Element.prototype, 'matches').mockImplementation(function (
      this: Element,
      selector: string,
    ) {
      return selector === ':focus-visible' ? focusVisible : matches.call(this, selector);
    });
    // Items of the original list sit where the animation has moved them; the strip is at 0.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      const list = screen.getByRole('list', { name: 'Official brands' });
      const index = Array.from(list.children).indexOf(this);
      return index < 0
        ? DOMRect.fromRect({ x: 0, y: 0, width: WIDTH, height: 112 })
        : DOMRect.fromRect({ x: itemLeft(index), y: 8, width: ITEM, height: 96 });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(HTMLElement.prototype, 'animate');
  });

  it('starts where the server drew the list, first item at the left edge', () => {
    renderMarquee();
    expect(loop().options).toMatchObject({ iterations: Infinity, easing: 'linear' });
    expect(itemLeft(0)).toBeCloseTo(0);
    expect(loop().paused).toBe(false);
  });

  it('brings the first item clear of the edge fade, focus ring included, on keyboard focus', () => {
    renderMarquee();
    fireEvent.focus(link('Glow'));
    expect(loop().paused).toBe(true);
    expect(itemLeft(0) - RING).toBeGreaterThanOrEqual(FADE);
    expect(itemLeft(0) + ITEM + RING).toBeLessThanOrEqual(WIDTH - FADE);
  });

  it('keeps the first item in view when its rect is a hair left of the loop start', () => {
    renderMarquee();
    // Real layout rects carry float noise; a tiny negative offset must not wrap a whole copy.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      const list = screen.getByRole('list', { name: 'Official brands' });
      const index = Array.from(list.children).indexOf(this);
      const noise = index === 0 ? -1e-6 : 0;
      return index < 0
        ? DOMRect.fromRect({ x: 0, y: 0, width: WIDTH, height: 112 })
        : DOMRect.fromRect({ x: itemLeft(index) + noise, y: 8, width: ITEM, height: 96 });
    });
    fireEvent.focus(link('Glow'));
    expect(itemLeft(0) - RING).toBeGreaterThanOrEqual(FADE);
    expect(itemLeft(0) + ITEM + RING).toBeLessThanOrEqual(WIDTH - FADE);
  });

  it('brings an item out of the right-hand fade the same way', () => {
    renderMarquee();
    // Luxe (750–950) ends inside the right fade (920–1000).
    expect(itemLeft(3) + ITEM).toBeGreaterThan(WIDTH - FADE);
    fireEvent.focus(link('Luxe'));
    expect(itemLeft(3) - RING).toBeGreaterThanOrEqual(FADE);
    expect(itemLeft(3) + ITEM + RING).toBeLessThanOrEqual(WIDTH - FADE);
  });

  it('leaves an item that is already clear of the fades where it is', () => {
    renderMarquee();
    const before = loop().currentTime;
    fireEvent.focus(link('Velvet'));
    expect(loop().currentTime).toBe(before);
    expect(loop().paused).toBe(true);
  });

  it('only pauses on mouse focus: moving the item then would lose the click', () => {
    focusVisible = false;
    renderMarquee();
    const before = loop().currentTime;
    fireEvent.focus(link('Glow'));
    expect(loop().currentTime).toBe(before);
    expect(loop().paused).toBe(true);
  });

  it('pauses while hovered and resumes on leave', () => {
    renderMarquee();
    fireEvent.mouseEnter(strip());
    expect(loop().paused).toBe(true);
    fireEvent.mouseLeave(strip());
    expect(loop().paused).toBe(false);
  });

  it('stays paused while focus moves between items and resumes once it leaves the strip', () => {
    renderMarquee();
    fireEvent.focus(link('Glow'));
    fireEvent.blur(link('Glow'), { relatedTarget: link('Velvet') });
    fireEvent.focus(link('Velvet'));
    expect(loop().paused).toBe(true);
    fireEvent.blur(link('Velvet'), { relatedTarget: screen.getByRole('button') });
    expect(loop().paused).toBe(false);
  });

  it('holds while any reason remains: hover and focus together', () => {
    renderMarquee();
    fireEvent.mouseEnter(strip());
    fireEvent.focus(link('Velvet'));
    fireEvent.mouseLeave(strip());
    expect(loop().paused).toBe(true);
    fireEvent.blur(link('Velvet'), { relatedTarget: null });
    expect(loop().paused).toBe(false);
  });

  it('pauses off screen and resumes when back', () => {
    renderMarquee();
    const [observe] = observers;
    const seen = (isIntersecting: boolean) => [{ isIntersecting } as IntersectionObserverEntry];
    act(() => observe?.(seen(false), {} as IntersectionObserver));
    expect(loop().paused).toBe(true);
    act(() => observe?.(seen(true), {} as IntersectionObserver));
    expect(loop().paused).toBe(false);
  });

  it('pauses and plays from the button, and hover does not undo it', () => {
    renderMarquee();
    fireEvent.click(screen.getByRole('button', { name: 'Pause scrolling' }));
    expect(loop().paused).toBe(true);
    fireEvent.mouseEnter(strip());
    fireEvent.mouseLeave(strip());
    expect(loop().paused).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Play scrolling' }));
    expect(loop().paused).toBe(false);
  });
});

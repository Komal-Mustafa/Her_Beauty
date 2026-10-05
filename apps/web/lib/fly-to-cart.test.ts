// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flightKeyframes, flyToCart, FLY_MS, isOnScreen, startBox, type Box } from './fly-to-cart';

const view = { width: 360, height: 640 };
const box = (left: number, top: number, width: number, height: number): Box => ({
  left,
  top,
  width,
  height,
});

describe('isOnScreen', () => {
  it.each([
    ['inside', box(10, 10, 44, 44), true],
    ['partly above', box(10, -20, 44, 44), true],
    ['above', box(10, -60, 44, 44), false],
    ['below', box(10, 700, 44, 44), false],
    ['right of it', box(400, 10, 44, 44), false],
    ['not rendered', box(0, 0, 0, 0), false],
  ])('%s', (_, b, expected) => {
    expect(isOnScreen(b, view)).toBe(expected);
  });
});

describe('startBox', () => {
  it('starts from the image itself', () => {
    const image = box(0, 100, 360, 450);
    expect(startBox(image, true)).toBe(image);
  });

  it('starts from a small square centred on a button', () => {
    expect(startBox(box(16, 580, 200, 48), false)).toEqual(box(92, 580, 48, 48));
  });
});

describe('flightKeyframes', () => {
  it('lands the centre on the icon, shrunk to its size, faded out', () => {
    const frames = flightKeyframes(box(0, 100, 400, 500), box(300, 18, 44, 44));
    expect(frames[0]).toEqual({ transform: 'translate(0px, 0px) scale(1)', opacity: 1 });
    // centre (200, 350) → (322, 40); 44 / 400 = 0.11
    expect(frames.at(-1)).toEqual({
      transform: 'translate(122px, -310px) scale(0.11)',
      opacity: 0,
    });
    expect(frames[1]).toMatchObject({
      offset: 0.75,
      transform: 'translate(91.5px, -232.5px) scale(0.333)',
    });
  });

  it('only animates transform and opacity', () => {
    for (const frame of flightKeyframes(box(0, 0, 100, 100), box(10, 10, 10, 10))) {
      expect(Object.keys(frame).sort()).toEqual(
        'offset' in frame ? ['offset', 'opacity', 'transform'] : ['opacity', 'transform'],
      );
    }
  });
});

describe('flyToCart', () => {
  let animate: ReturnType<typeof vi.fn>;
  let reduced = false;
  let target: HTMLElement;
  let image: HTMLImageElement;
  let button: HTMLButtonElement;

  const place = (el: Element, b: Box) =>
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      ...b,
      x: b.left,
      y: b.top,
      right: b.left + b.width,
      bottom: b.top + b.height,
      toJSON: () => b,
    });

  beforeEach(() => {
    reduced = false;
    vi.stubGlobal('innerWidth', 360);
    vi.stubGlobal('innerHeight', 640);
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: reduced && query.includes('reduce'),
      addEventListener() {},
      removeEventListener() {},
    }));
    animate = vi.fn(() => new EventTarget());
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      writable: true,
      value: animate,
    });
    target = document.createElement('a');
    target.dataset.cartTarget = '';
    image = document.createElement('img');
    button = document.createElement('button');
    document.body.append(target, image, button);
    place(target, box(300, 18, 44, 44));
    place(image, box(0, 100, 360, 450));
    place(button, box(16, 580, 200, 48));
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Reflect.deleteProperty(HTMLElement.prototype, 'animate');
  });

  const ghosts = () => document.querySelectorAll('img[aria-hidden="true"]');

  it('flies a copy of the image to the cart icon and removes it when it lands', () => {
    const animation = flyToCart({
      imageSrc: '/placeholders/lipstick-1.svg',
      from: [image, button],
    });
    expect(animation).not.toBeNull();
    expect(ghosts()).toHaveLength(1);
    const ghost = ghosts()[0] as HTMLImageElement;
    expect(ghost.getAttribute('src')).toBe('/placeholders/lipstick-1.svg');
    expect(ghost.style.width).toBe('360px');
    expect(animate).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ duration: FLY_MS }),
    );
    animation?.dispatchEvent(new Event('finish'));
    expect(ghosts()).toHaveLength(0);
  });

  it('starts from the button when the image is scrolled away', () => {
    place(image, box(0, -600, 360, 450));
    flyToCart({ imageSrc: '/x.svg', from: [image, button] });
    expect((ghosts()[0] as HTMLImageElement).style.width).toBe('48px');
  });

  it('is skipped under reduced motion', () => {
    reduced = true;
    expect(flyToCart({ imageSrc: '/x.svg', from: [image] })).toBeNull();
    expect(ghosts()).toHaveLength(0);
  });

  it('is skipped when the cart icon is off screen or missing', () => {
    place(target, box(300, -80, 44, 44));
    expect(flyToCart({ imageSrc: '/x.svg', from: [image] })).toBeNull();
    target.remove();
    expect(flyToCart({ imageSrc: '/x.svg', from: [image] })).toBeNull();
    expect(animate).not.toHaveBeenCalled();
  });

  it('is skipped when no starting point is on screen', () => {
    place(image, box(0, 900, 360, 450));
    expect(flyToCart({ imageSrc: '/x.svg', from: [image, null] })).toBeNull();
  });
});

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Carousel } from './carousel';

afterEach(cleanup);

function renderCarousel(onOpen = vi.fn()) {
  render(
    <Carousel label="Trending now" header={<h2>Trending now</h2>}>
      {Array.from({ length: 12 }, (_, i) => (
        <a key={i} href={`/product/p-${i}`} onClick={(e) => (e.preventDefault(), onOpen(i))}>
          Product {i}
        </a>
      ))}
    </Carousel>,
  );
  return onOpen;
}

const track = () => screen.getByRole('list');

/** A real pointer sequence: press, move `dx` in steps, release. */
function drag(el: HTMLElement, dx: number) {
  fireEvent.pointerDown(el, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 300 });
  for (let i = 1; i <= 5; i++) {
    fireEvent.pointerMove(window, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 300 + (dx * i) / 5,
    });
  }
  fireEvent.pointerUp(window, { pointerId: 1, pointerType: 'mouse', clientX: 300 + dx });
}

describe('Carousel', () => {
  it('is a labelled carousel region whose items are list items', () => {
    renderCarousel();
    const region = screen.getByRole('region', { name: 'Trending now' });
    expect(region.getAttribute('aria-roledescription')).toBe('carousel');
    expect(screen.getAllByRole('listitem')).toHaveLength(12);
  });

  it('has prev/next buttons that control the track; prev is disabled at the start', () => {
    renderCarousel();
    const prev = screen.getByRole('button', { name: 'Previous' });
    const next = screen.getByRole('button', { name: 'Next' });
    expect(prev.getAttribute('aria-controls')).toBe(track().id);
    expect(next.getAttribute('aria-controls')).toBe(track().id);
    // aria-disabled, not disabled: focus stays on the button when paging hits an end.
    expect(prev.getAttribute('aria-disabled')).toBe('true');
    expect(prev.hasAttribute('disabled')).toBe(false);
  });

  it('pages with the next button and enables prev once scrolled', () => {
    renderCarousel();
    const el = track();
    const scrollTo = vi.fn();
    el.scrollTo = scrollTo;
    Object.defineProperty(el, 'scrollWidth', { configurable: true, value: 2400 });
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: 600 });
    fireEvent.scroll(el);
    const next = screen.getByRole('button', { name: 'Next' });
    expect(next.getAttribute('aria-disabled')).toBe('false');
    fireEvent.click(next);
    expect(scrollTo).toHaveBeenCalledTimes(1);

    el.scrollLeft = 1800;
    fireEvent.scroll(el);
    expect(screen.getByRole('button', { name: 'Previous' }).getAttribute('aria-disabled')).toBe(
      'false',
    );
    expect(next.getAttribute('aria-disabled')).toBe('true');
  });

  it('does nothing when an end button is pressed', () => {
    renderCarousel();
    const scrollTo = vi.fn();
    track().scrollTo = scrollTo;
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('swallows the click that ends a mouse drag', () => {
    const onOpen = renderCarousel();
    track().scrollTo = vi.fn();
    const link = screen.getByRole('link', { name: 'Product 2' });
    drag(link, -120);
    fireEvent.click(link);
    expect(onOpen).not.toHaveBeenCalled();
    // The next, unrelated click works again.
    fireEvent.click(link);
    expect(onOpen).toHaveBeenCalledWith(2);
  });

  it('keeps a plain click (movement under the threshold) a click', () => {
    const onOpen = renderCarousel();
    const link = screen.getByRole('link', { name: 'Product 3' });
    drag(link, 3);
    fireEvent.click(link);
    expect(onOpen).toHaveBeenCalledWith(3);
  });

  it('turns snapping off while dragging and marks the track', () => {
    renderCarousel();
    const el = track();
    el.scrollTo = vi.fn();
    fireEvent.pointerDown(el, { pointerId: 7, pointerType: 'mouse', button: 0, clientX: 300 });
    fireEvent.pointerMove(window, { pointerId: 7, pointerType: 'mouse', clientX: 250 });
    expect(el.dataset.dragging).toBe('true');
    expect(el.style.scrollSnapType).toBe('none');
    fireEvent.pointerUp(window, { pointerId: 7, pointerType: 'mouse', clientX: 250 });
    expect(el.dataset.dragging).toBeUndefined();
  });

  it('leaves touch to the native scroller', () => {
    renderCarousel();
    const el = track();
    fireEvent.pointerDown(el, { pointerId: 2, pointerType: 'touch', clientX: 300 });
    fireEvent.pointerMove(window, { pointerId: 2, pointerType: 'touch', clientX: 100 });
    expect(el.dataset.dragging).toBeUndefined();
  });
});

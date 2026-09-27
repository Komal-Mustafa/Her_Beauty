import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Marquee } from './marquee';

afterEach(cleanup);

function renderMarquee(props: Partial<Parameters<typeof Marquee>[0]> = {}) {
  return render(
    <Marquee label="Official brands" {...props}>
      {['Glow', 'Velvet', 'Dewy'].map((name) => (
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
    expect(list.querySelectorAll('li')).toHaveLength(3);
    // The copies that make the loop are hidden and cannot be focused.
    expect(screen.getAllByRole('link')).toHaveLength(3);
  });

  it('marks every repeated copy aria-hidden and inert', () => {
    const { container } = renderMarquee();
    const copies = container.querySelectorAll('ul[aria-hidden="true"]');
    expect(copies.length).toBeGreaterThanOrEqual(1);
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

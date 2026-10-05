// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EMPTY_LISTING, type ListingParams } from '@/lib/listing-url';
import { pageWindow, Pagination } from './pagination';

afterEach(cleanup);

const params = (over: Partial<ListingParams> = {}): ListingParams => ({
  ...EMPTY_LISTING,
  ...over,
});

describe('pageWindow', () => {
  it('shows every page when there are few', () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('keeps the first, the last and the neighbours of the current page', () => {
    expect(pageWindow(1, 10)).toEqual([1, 2, 'gap', 10]);
    expect(pageWindow(5, 10)).toEqual([1, 'gap', 4, 5, 6, 'gap', 10]);
    expect(pageWindow(10, 10)).toEqual([1, 'gap', 9, 10]);
  });

  it('shows a single hidden page instead of a gap', () => {
    // 1 … 3 would hide only page 2.
    expect(pageWindow(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(pageWindow(4, 10)).toEqual([1, 2, 3, 4, 5, 'gap', 10]);
  });

  it('is empty without pages', () => {
    expect(pageWindow(1, 0)).toEqual([]);
  });
});

describe('Pagination', () => {
  const nav = () => screen.getByRole('navigation', { name: 'Pagination' });

  it('renders nothing for a single page', () => {
    const { container } = render(<Pagination path="/new" params={params()} pageCount={1} />);
    expect(container.innerHTML).toBe('');
  });

  it('links every page with the filters, page 1 without a page param', () => {
    render(
      <Pagination
        path="/category/lips"
        params={params({ brand: ['glow'], sort: 'newest', page: 2 })}
        pageCount={3}
      />,
    );
    const page1 = within(nav()).getByRole('link', { name: 'Page 1' });
    expect(page1.getAttribute('href')).toBe('/category/lips?brand=glow&sort=newest');
    expect(within(nav()).getByRole('link', { name: 'Page 3' }).getAttribute('href')).toBe(
      '/category/lips?brand=glow&sort=newest&page=3',
    );
    const current = nav().querySelector('[aria-current="page"]');
    expect(current?.textContent).toBe('2Page 2');
    expect(current?.tagName).toBe('SPAN');
  });

  it('disables Previous on the first page and Next on the last', () => {
    const { unmount } = render(<Pagination path="/new" params={params()} pageCount={4} />);
    const previous = within(nav()).getByRole('link', { name: 'Previous' });
    expect(previous.getAttribute('aria-disabled')).toBe('true');
    expect(previous.hasAttribute('href')).toBe(false);
    expect(within(nav()).getByRole('link', { name: 'Next' }).getAttribute('href')).toBe(
      '/new?page=2',
    );
    unmount();

    render(<Pagination path="/new" params={params({ page: 4 })} pageCount={4} />);
    expect(within(nav()).getByRole('link', { name: 'Previous' }).getAttribute('href')).toBe(
      '/new?page=3',
    );
    const next = within(nav()).getByRole('link', { name: 'Next' });
    expect(next.getAttribute('aria-disabled')).toBe('true');
    expect(next.hasAttribute('href')).toBe(false);
  });

  it('marks gaps with an ellipsis hidden from screen readers', () => {
    render(<Pagination path="/search" params={params({ q: 'lip', page: 6 })} pageCount={12} />);
    const items = within(nav()).getAllByRole('listitem', { hidden: true });
    expect(items.map((li) => li.textContent?.replace(/Page \d+$/, ''))).toEqual([
      'Previous',
      '1',
      '…',
      '5',
      '6',
      '7',
      '…',
      '12',
      'Next',
    ]);
    const gaps = items.filter((li) => li.textContent === '…');
    expect(gaps.every((li) => li.getAttribute('aria-hidden') === 'true')).toBe(true);
  });
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ProductReviews, REVIEWS_SHOWN } from './product-reviews';
import { ReviewPhotos } from './review-photos';
import { lipstick, review } from './test-product';

const PHOTOS = [1, 2, 3].map((n) => ({
  url: `/placeholders/review-${n}.svg`,
  alt: n === 2 ? '' : `Swatch ${n}`,
  width: 800,
  height: 800,
}));

afterEach(cleanup);

describe('ProductReviews', () => {
  it('summarises the rating in words as well as stars', () => {
    render(<ProductReviews product={lipstick()} reviews={[review(1)]} />);
    const section = screen.getByRole('region', { name: 'Reviews' });
    expect(section.id).toBe('reviews');
    expect(within(section).getByText('214 ratings')).toBeTruthy();
    expect(within(section).getByText('4.8 out of 5 stars')).toBeTruthy();
    expect(
      within(section).getByText('Only shoppers who received this product can review it.'),
    ).toBeTruthy();
  });

  it('lists the newest reviews first with their stars, date and verified badge', () => {
    const reviews = [
      review(1, { rating: 4, title: 'Older' }),
      review(3, { rating: 5, title: 'Newest' }),
      review(2, { rating: 3, title: 'Middle' }),
    ];
    render(<ProductReviews product={lipstick()} reviews={reviews} />);
    const cards = screen.getAllByRole('article');
    expect(cards.map((c) => within(c).getByRole('heading', { level: 3 }).textContent)).toEqual([
      'Newest',
      'Middle',
      'Older',
    ]);
    const first = within(cards[0]!);
    expect(first.getByText('5 out of 5 stars')).toBeTruthy();
    expect(first.getByText('Verified purchase')).toBeTruthy();
    const time = cards[0]!.querySelector('time')!;
    expect(time.getAttribute('dateTime')).toBe('2026-09-13T10:00:00.000Z');
    expect(time.textContent).toMatch(/13 Sept? 2026/);
  });

  it('shows at most REVIEWS_SHOWN and says how many there are', () => {
    const reviews = Array.from({ length: REVIEWS_SHOWN + 3 }, (_, i) => review(i + 1));
    render(<ProductReviews product={lipstick()} reviews={reviews} />);
    expect(screen.getAllByRole('article')).toHaveLength(REVIEWS_SHOWN);
    expect(
      screen.getByText(`Showing the ${REVIEWS_SHOWN} newest of ${REVIEWS_SHOWN + 3} reviews.`),
    ).toBeTruthy();
  });

  it('says when there are no written reviews, or no ratings at all', () => {
    render(<ProductReviews product={lipstick({ rating: 0, ratingCount: 0 })} reviews={[]} />);
    expect(screen.getByText('No written reviews yet.')).toBeTruthy();
    expect(screen.getByText('No ratings yet')).toBeTruthy();
  });

  it('keeps the page working when the reviews could not be loaded', () => {
    render(<ProductReviews product={lipstick()} reviews={null} />);
    expect(screen.getByText('We couldn’t load the reviews right now.')).toBeTruthy();
    expect(screen.getByText('214 ratings')).toBeTruthy();
  });
});

describe('ReviewPhotos', () => {
  it('renders nothing without photos', () => {
    const { container } = render(<ReviewPhotos photos={[]} author="Ayesha K." />);
    expect(container.innerHTML).toBe('');
  });

  it('opens a photo in a lightbox and steps through the others', () => {
    render(<ReviewPhotos photos={PHOTOS} author="Ayesha K." />);
    fireEvent.click(screen.getByRole('button', { name: 'Open photo 2 of 3 from Ayesha K.' }));
    const dialog = screen.getByRole('dialog', { name: 'Photo 2 of 3' });
    expect(within(dialog).getByText('From Ayesha K.’s review')).toBeTruthy();
    // A photo without its own alt text still gets one.
    expect(within(dialog).getByRole('img', { name: 'Photo from Ayesha K.’s review' })).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Next photo' }));
    expect(screen.getByRole('dialog', { name: 'Photo 3 of 3' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next photo' }));
    expect(screen.getByRole('dialog', { name: 'Photo 1 of 3' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Swatch 1' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Previous photo' }));
    expect(screen.getByRole('dialog', { name: 'Photo 3 of 3' })).toBeTruthy();
  });

  it('steps with the arrow keys and closes with Escape', () => {
    render(<ReviewPhotos photos={PHOTOS} author="Ayesha K." />);
    fireEvent.click(screen.getByRole('button', { name: 'Open photo 1 of 3 from Ayesha K.' }));
    const img = screen.getByRole('img', { name: 'Swatch 1' });
    fireEvent.keyDown(img, { key: 'ArrowRight' });
    expect(screen.getByRole('dialog', { name: 'Photo 2 of 3' })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('img', { name: 'Photo from Ayesha K.’s review' }), {
      key: 'ArrowLeft',
    });
    expect(screen.getByRole('dialog', { name: 'Photo 1 of 3' })).toBeTruthy();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('has no previous / next for a single photo', () => {
    render(<ReviewPhotos photos={PHOTOS.slice(0, 1)} author="Ayesha K." />);
    fireEvent.click(screen.getByRole('button', { name: 'Open photo 1 of 1 from Ayesha K.' }));
    expect(screen.getByRole('dialog', { name: 'Review photo' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Next photo' })).toBeNull();
  });
});

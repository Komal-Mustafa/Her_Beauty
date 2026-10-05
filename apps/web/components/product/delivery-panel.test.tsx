// @vitest-environment jsdom
import type { DeliveryEstimate, PkCity } from '@hb/types';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CITY_STORAGE_KEY } from '@/lib/city-store';
import type { DeliveryEstimateResult } from './delivery-text';

const SLUG = 'velvet-matte-lipstick';

const estimate = (city: PkCity, over: Partial<DeliveryEstimate> = {}): DeliveryEstimate => ({
  city,
  zone: 'province',
  daysMin: 2,
  daysMax: 4,
  fee: 25_000,
  freeShippingMin: 300_000,
  codAvailable: true,
  ...over,
});

type GetEstimate = (slug: string, city: PkCity) => Promise<DeliveryEstimateResult>;

/** An answer the test settles when it wants. */
function deferred() {
  let settle: (result: DeliveryEstimateResult) => void = () => {};
  let fail: (error: Error) => void = () => {};
  const promise = new Promise<DeliveryEstimateResult>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  return { promise, settle, fail };
}

/** A fresh page (new city store) with the panel. */
async function renderPanel(getEstimate: GetEstimate) {
  vi.resetModules();
  const { DeliveryPanel } = await import('./delivery-panel');
  render(<DeliveryPanel productSlug={SLUG} getEstimate={getEstimate} />);
}

const select = () => screen.getByLabelText('Delivery to') as HTMLSelectElement;
const status = () => screen.getByRole('status');
const choose = (city: PkCity) => fireEvent.change(select(), { target: { value: city } });
/** Lets resolved promises and the state they set land. */
const flush = () => act(async () => {});

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('DeliveryPanel', () => {
  it('lists the cities by province and asks for one when none is remembered', async () => {
    const getEstimate = vi.fn<GetEstimate>();
    await renderPanel(getEstimate);
    expect(select().value).toBe('');
    const groups = select().querySelectorAll('optgroup');
    expect([...groups].map((g) => g.label)).toContain('Gilgit-Baltistan');
    const gb = [...groups].find((g) => g.label === 'Gilgit-Baltistan');
    expect(
      within(gb as HTMLElement)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Gilgit', 'Skardu']);
    expect(status().textContent).toBe('Choose your city to see delivery time and cost.');
    expect(getEstimate).not.toHaveBeenCalled();
  });

  it('shows the estimate for the chosen city and remembers it', async () => {
    const getEstimate = vi.fn<GetEstimate>(async (_slug, city) => ({
      ok: true,
      estimate: estimate(city),
    }));
    await renderPanel(getEstimate);
    choose('Lahore');
    await flush();
    expect(getEstimate).toHaveBeenCalledWith(SLUG, 'Lahore');
    expect(status().textContent).toBe(
      '2–4 days · Rs 250 · free over Rs 3,000 · Cash on delivery available',
    );
    expect(window.localStorage.getItem(CITY_STORAGE_KEY)).toBe('"Lahore"');
    // The select is described by the result, so focusing it reads the estimate.
    expect(select().getAttribute('aria-describedby')).toBe(status().id);
  });

  it('asks again for a remembered city on the next visit', async () => {
    window.localStorage.setItem(CITY_STORAGE_KEY, '"Gilgit"');
    const getEstimate = vi.fn<GetEstimate>(async (_slug, city) => ({
      ok: true,
      estimate: estimate(city, { zone: 'remote', fee: null, daysMin: 5, daysMax: 9 }),
    }));
    await renderPanel(getEstimate);
    await flush();
    expect(select().value).toBe('Gilgit');
    expect(getEstimate).toHaveBeenCalledWith(SLUG, 'Gilgit');
    expect(status().textContent).toBe(
      '5–9 days · Delivery fee confirmed at checkout · free over Rs 3,000 · Cash on delivery available',
    );
  });

  it('does not flash the prompt before a remembered city after hydration', async () => {
    window.localStorage.setItem(CITY_STORAGE_KEY, '"Karachi"');
    const answer = deferred();
    const getEstimate = vi.fn<GetEstimate>().mockReturnValueOnce(answer.promise);
    vi.resetModules();
    const { DeliveryPanel } = await import('./delivery-panel');
    const ui = <DeliveryPanel productSlug={SLUG} getEstimate={getEstimate} />;
    // The server knows no city: an empty result line, not "Choose your city…".
    const html = renderToString(ui);
    expect(html).not.toContain('Choose your city to see');
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.append(container);
    const seen: string[] = [];
    const observer = new MutationObserver(() => seen.push(status().textContent ?? ''));
    observer.observe(container, { subtree: true, childList: true, characterData: true });
    render(ui, { container, hydrate: true });
    await act(async () => answer.settle({ ok: true, estimate: estimate('Karachi') }));
    observer.disconnect();
    expect(select().value).toBe('Karachi');
    expect(status().textContent).toMatch(/^2–4 days/);
    expect(seen.some((text) => text.startsWith('Choose your city'))).toBe(false);
  });

  it('drops a remembered city that is not on the list', async () => {
    window.localStorage.setItem(CITY_STORAGE_KEY, '"Dera Ismail Khan"');
    const getEstimate = vi.fn<GetEstimate>();
    await renderPanel(getEstimate);
    await flush();
    expect(select().value).toBe('');
    expect(status().textContent).toMatch(/^Choose your city/);
    expect(getEstimate).not.toHaveBeenCalled();
  });

  it('shows no loading text for a quick answer, and says it is checking after 100 ms', async () => {
    vi.useFakeTimers();
    const first = deferred();
    const second = deferred();
    const getEstimate = vi
      .fn<GetEstimate>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    await renderPanel(getEstimate);
    choose('Karachi');
    act(() => vi.advanceTimersByTime(99));
    expect(status().textContent).toBe('');
    await act(async () => first.settle({ ok: true, estimate: estimate('Karachi') }));
    expect(status().textContent).toMatch(/^2–4 days/);
    act(() => vi.advanceTimersByTime(500));
    expect(status().textContent).toMatch(/^2–4 days/);

    // Slow: the previous answer stays for 100 ms, then "Checking…", then the new answer.
    choose('Quetta');
    act(() => vi.advanceTimersByTime(99));
    expect(status().textContent).toMatch(/^2–4 days/);
    act(() => vi.advanceTimersByTime(1));
    expect(status().textContent).toBe('Checking delivery to Quetta…');
    await act(async () =>
      second.settle({ ok: true, estimate: estimate('Quetta', { daysMin: 3, daysMax: 5 }) }),
    );
    expect(status().textContent).toMatch(/^3–5 days/);
  });

  it('says when there is no estimate, keeps working, and tries again on request', async () => {
    const getEstimate = vi
      .fn<GetEstimate>()
      .mockResolvedValueOnce({ ok: false })
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ ok: true, estimate: estimate('Multan') });
    await renderPanel(getEstimate);
    choose('Multan');
    await flush();
    expect(status().textContent).toBe('We couldn’t get an estimate right now.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await flush();
    expect(status().textContent).toBe('We couldn’t get an estimate right now.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await flush();
    expect(getEstimate).toHaveBeenCalledTimes(3);
    expect(status().textContent).toMatch(/^2–4 days/);
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('ignores an answer for a city the shopper has already changed', async () => {
    const lahore = deferred();
    const getEstimate = vi
      .fn<GetEstimate>()
      .mockReturnValueOnce(lahore.promise)
      .mockResolvedValueOnce({
        ok: true,
        estimate: estimate('Sukkur', { daysMin: 4, daysMax: 6 }),
      });
    await renderPanel(getEstimate);
    choose('Lahore');
    choose('Sukkur');
    await flush();
    await act(async () => lahore.settle({ ok: true, estimate: estimate('Lahore') }));
    expect(status().textContent).toMatch(/^4–6 days/);
  });
});

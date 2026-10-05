import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CITY_STORAGE_KEY, MAX_CITY_LENGTH, parseCity } from './city-store';
import { fakeWindow } from './test-window';

describe('parseCity', () => {
  it.each([
    ['Lahore', 'Lahore'],
    ['  Dera   Ismail Khan ', 'Dera Ismail Khan'],
    ['Mirpur-Khas', 'Mirpur-Khas'],
    ['لاہور', 'لاہور'],
  ])('accepts %j', (raw, clean) => {
    expect(parseCity(raw)).toBe(clean);
  });

  it.each([
    ['empty', ''],
    ['blank', '   '],
    ['too long', 'A'.repeat(MAX_CITY_LENGTH + 1)],
    ['markup', '<img src=x onerror=alert(1)>'],
    ['a URL', 'https://evil.example'],
    ['digits first', '1 Lahore'],
    ['not a string', 42],
    ['an object', { city: 'Lahore' }],
    ['null', null],
  ])('refuses %s', (_, raw) => {
    expect(parseCity(raw)).toBeNull();
  });
});

describe('city store', () => {
  let env: ReturnType<typeof fakeWindow>;
  beforeEach(() => {
    vi.resetModules();
    env = fakeWindow();
    vi.stubGlobal('window', env.win);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('remembers a valid city under hb_city_v1', async () => {
    const city = await import('./city-store');
    expect(city.setCity(' Karachi ')).toBe(true);
    expect(env.data.get(CITY_STORAGE_KEY)).toBe('"Karachi"');
  });

  it('keeps the old city when the new one is invalid', async () => {
    const city = await import('./city-store');
    city.setCity('Karachi');
    expect(city.setCity('<script>')).toBe(false);
    expect(env.data.get(CITY_STORAGE_KEY)).toBe('"Karachi"');
  });

  it('renders no city on the server whatever is stored', async () => {
    env.data.set(CITY_STORAGE_KEY, JSON.stringify('Lahore'));
    const city = await import('./city-store');
    const Show = () => createElement('span', null, city.useCity() ?? 'none');
    expect(renderToString(createElement(Show))).toBe('<span>none</span>');
  });
});

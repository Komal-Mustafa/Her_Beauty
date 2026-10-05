import { PK_CITIES } from '@hb/types';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CITY_STORAGE_KEY, parseCity } from './city-store';
import { fakeWindow } from './test-window';

describe('parseCity', () => {
  it('accepts every listed city', () => {
    for (const { name } of PK_CITIES) expect(parseCity(name)).toBe(name);
  });

  // A stored value from the free-text store this replaced, or an edited one, is dropped.
  it.each([
    ['an unlisted city', 'Dera Ismail Khan'],
    ['a city outside Pakistan', 'Dubai'],
    ['another case', 'lahore'],
    ['surrounding spaces', ' Karachi '],
    ['empty', ''],
    ['markup', '<img src=x onerror=alert(1)>'],
    ['a URL', 'https://evil.example'],
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

  it('remembers a listed city under hb_city_v1', async () => {
    const city = await import('./city-store');
    expect(city.setCity('Karachi')).toBe(true);
    expect(env.data.get(CITY_STORAGE_KEY)).toBe('"Karachi"');
  });

  it('keeps the old city when the new one is not listed', async () => {
    const city = await import('./city-store');
    city.setCity('Karachi');
    expect(city.setCity('<script>')).toBe(false);
    expect(city.setCity('Dera Ismail Khan')).toBe(false);
    expect(env.data.get(CITY_STORAGE_KEY)).toBe('"Karachi"');
  });

  it('renders no city on the server whatever is stored', async () => {
    env.data.set(CITY_STORAGE_KEY, JSON.stringify('Lahore'));
    const city = await import('./city-store');
    const Show = () => createElement('span', null, city.useCity() ?? 'none');
    expect(renderToString(createElement(Show))).toBe('<span>none</span>');
  });
});

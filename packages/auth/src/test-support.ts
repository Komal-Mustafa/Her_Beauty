// Shared fakes for the unit tests (not exported from the package).
import type { Me, TokenPair } from '@hb/types';
import { vi } from 'vitest';
import type { CookieOptions } from './cookies';
import type { CookieJar } from './core';

export const ME: Me = {
  id: '0192a000-0000-7000-8000-000000000001',
  fullName: 'Ayesha Khan',
  email: 'ayesha@hb.test',
  phone: '+923001234567',
  emailVerified: true,
  phoneVerified: false,
  role: 'customer',
  hasPassword: true,
  twoFactorEnabled: false,
  seller: null,
  createdAt: '2026-09-01T10:00:00.000Z',
};

/** Fixed "now" shared by the tests' fake clocks. */
export const TEST_NOW = Date.parse('2026-09-26T10:00:00Z');

export function tokens(n: number): TokenPair {
  return {
    accessToken: `at-${n}`,
    accessExpiresAt: new Date(TEST_NOW + 15 * 60_000).toISOString(),
    refreshToken: `rt-${n}`,
    refreshExpiresAt: new Date(TEST_NOW + 30 * 24 * 3600_000).toISOString(),
  };
}

/** Mimics next/headers cookies(): mutable in actions, throws on write in server components. */
export class FakeJar implements CookieJar {
  readonly values = new Map<string, string>();
  readonly writes: Array<{ name: string; value: string; options: CookieOptions }> = [];
  readonly = false;

  constructor(initial: Record<string, string> = {}) {
    for (const [k, v] of Object.entries(initial)) this.values.set(k, v);
  }

  get(name: string) {
    const value = this.values.get(name);
    return value ? { value } : undefined;
  }

  set(name: string, value: string, options: CookieOptions) {
    if (this.readonly) throw new Error('Cookies can only be modified in a Server Action');
    this.writes.push({ name, value, options });
    if (options.maxAge === 0 || value === '') this.values.delete(name);
    else this.values.set(name, value);
  }
}

type Reply = { status: number; body?: unknown; headers?: Record<string, string> } | 'network';

export type Call = {
  method: string;
  path: string;
  body: unknown;
  headers: Record<string, string>;
};

/** A fake API: queue replies per "METHOD /path"; records every call. */
export function fakeApi(routes: Record<string, Reply[]>) {
  const calls: Call[] = [];
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const path = url.replace('http://api.test/v1', '');
    const method = init?.method ?? 'GET';
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    calls.push({ method, path, body, headers });
    const reply = routes[`${method} ${path}`]?.shift();
    if (!reply) throw new Error(`unexpected call ${method} ${path}`);
    if (reply === 'network') throw new TypeError('fetch failed');
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
      status: reply.status,
      headers: { 'content-type': 'application/json', ...reply.headers },
    });
  });
  const count = (key: string) => calls.filter((c) => `${c.method} ${c.path}` === key).length;
  return { fetch, calls, count };
}

export function apiError(status: number, code: string, details: object = {}) {
  return { status, body: { error: { code, message: 'api message', details } } };
}

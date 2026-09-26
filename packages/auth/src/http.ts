// Low-level calls to the NestJS API. Edge-safe (used by the middleware for refresh too).
import { apiBaseUrl } from './env';
import { ApiRequestError, errorFromResponse } from './errors';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Anything with a zod-style `parse` (every @hb/types schema qualifies). */
export interface Schema<T> {
  parse(input: unknown): T;
}

/** For endpoints whose body we do not read (204s, and 202s with an informational body). */
export const IgnoreBody: Schema<void> = { parse: () => undefined };

export type ForwardHeaders = { ip?: string; userAgent?: string };

export type HeaderReader = { get(name: string): string | null };

/**
 * The browser's IP and user agent, taken from the request that reached Next.js: first
 * X-Forwarded-For value, else X-Real-IP. The API trusts these only from its TRUST_PROXY hops.
 */
export function clientForwardHeaders(headers: HeaderReader): ForwardHeaders {
  const forwarded: ForwardHeaders = {};
  const first = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = first || headers.get('x-real-ip')?.trim();
  if (ip) forwarded.ip = ip;
  const userAgent = headers.get('user-agent')?.trim();
  if (userAgent) forwarded.userAgent = userAgent.slice(0, 512);
  return forwarded;
}

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type ApiCall = {
  method?: HttpMethod;
  /** JSON-serialised when present. */
  body?: unknown;
  bearer?: string;
  forward?: ForwardHeaders;
  fetch?: FetchLike;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * One request to `${apiBaseUrl()}${path}`. Throws ApiRequestError for non-2xx answers
 * (with the API `error.code`), `NETWORK` when the API cannot be reached and `BAD_RESPONSE`
 * when the body does not match `schema`. Never caches.
 */
export async function callApi<T>(path: string, schema: Schema<T>, call: ApiCall = {}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (call.body !== undefined) headers['content-type'] = 'application/json';
  if (call.bearer) headers.authorization = `Bearer ${call.bearer}`;
  if (call.forward?.ip) headers['x-forwarded-for'] = call.forward.ip;
  if (call.forward?.userAgent) headers['user-agent'] = call.forward.userAgent;

  const doFetch = call.fetch ?? fetch;
  let res: Response;
  try {
    res = await doFetch(`${apiBaseUrl()}${path}`, {
      method: call.method ?? 'GET',
      headers,
      body: call.body === undefined ? undefined : JSON.stringify(call.body),
      cache: 'no-store',
      signal: AbortSignal.timeout(call.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch {
    throw new ApiRequestError(0, 'NETWORK', 'The API could not be reached.');
  }
  if (!res.ok) throw await errorFromResponse(res);

  const text = await res.text().catch(() => '');
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new ApiRequestError(res.status, 'BAD_RESPONSE', 'The API answered with invalid JSON.');
    }
  }
  try {
    return schema.parse(data);
  } catch {
    throw new ApiRequestError(
      res.status,
      'BAD_RESPONSE',
      `Unexpected response shape from ${path}.`,
    );
  }
}

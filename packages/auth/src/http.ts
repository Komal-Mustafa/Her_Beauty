// Low-level calls to the NestJS API. Edge-safe (used by the middleware for refresh too).
import { apiBaseUrl, clientIpSettings, type ClientIpSettings } from './env';
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

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const HEX_GROUP = /^[0-9a-f]{1,4}$/i;

function isIpv6(value: string): boolean {
  if (!value.includes(':') || value.length > 45) return false;
  let text = value;
  const lastColon = text.lastIndexOf(':');
  const tail = text.slice(lastColon + 1);
  if (tail.includes('.')) {
    // IPv4-mapped / embedded form (::ffff:203.0.113.7): the dotted quad takes two groups.
    if (!IPV4.test(tail)) return false;
    text = `${text.slice(0, lastColon + 1)}0:0`;
  }
  const halves = text.split('::');
  if (halves.length > 2) return false;
  const groups = (part: string) => (part === '' ? [] : part.split(':'));
  const all = halves.flatMap(groups);
  if (!all.every((g) => HEX_GROUP.test(g))) return false;
  return halves.length === 2 ? all.length < 8 : all.length === 8;
}

/** A literal IPv4 or IPv6 address (no port, no zone). */
export function isIpAddress(value: string): boolean {
  return IPV4.test(value) || isIpv6(value);
}

/**
 * The browser's IP, from a source the deployment controls (docs/b2-auth.md §7):
 * - `CLIENT_IP_HEADER` set: that header only (e.g. `cf-connecting-ip`, which Cloudflare
 *   overwrites). Missing ⇒ unknown.
 * - otherwise the X-Forwarded-For entry `TRUSTED_PROXY_HOPS` places from the right. Proxies append
 *   to this header and Next.js keeps whatever the browser sent, so the left-most entries are
 *   client-controlled and never used (with fewer entries than hops, the left-most one is taken,
 *   like Express's trust proxy). With no proxy, Next.js itself fills the header from the socket.
 * Anything that is not an IP address is dropped: the API then sees the BFF's own address, one shared
 * bucket for every per-IP limit, never "no limit".
 */
export function clientIp(
  headers: HeaderReader,
  settings: ClientIpSettings = clientIpSettings(),
): string | undefined {
  let candidate: string | undefined;
  if (settings.header) {
    candidate = headers.get(settings.header)?.trim();
  } else {
    const hops = (headers.get('x-forwarded-for') ?? '')
      .split(',')
      .map((hop) => hop.trim())
      .filter(Boolean);
    candidate = hops[Math.max(0, hops.length - settings.proxyHops)];
  }
  return candidate && isIpAddress(candidate) ? candidate : undefined;
}

/**
 * The browser's IP (see clientIp) and user agent, taken from the request that reached Next.js.
 * The API trusts them only from its TRUST_PROXY hops (the BFF).
 */
export function clientForwardHeaders(headers: HeaderReader): ForwardHeaders {
  const forwarded: ForwardHeaders = {};
  const ip = clientIp(headers);
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

// Runtime settings read at call time (never at import), so builds and tests can change them.
// Edge-safe: no Node APIs.

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

const DEV_API_BASE_URL = 'http://localhost:4000/v1';

/**
 * Server-to-server API base URL, including the `/v1` prefix (docs/b2-auth.md §7):
 * API_INTERNAL_URL, else NEXT_PUBLIC_API_BASE_URL. The localhost fallback is dev-only.
 */
export function apiBaseUrl(): string {
  const url = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE_URL;
  if (url) return url.replace(/\/+$/, '');
  if (isProduction()) {
    throw new Error('API_INTERNAL_URL or NEXT_PUBLIC_API_BASE_URL must be set in production.');
  }
  return DEV_API_BASE_URL;
}

export type ClientIpSettings = {
  /** Header the edge proxy overwrites with the browser IP (e.g. `cf-connecting-ip`), lower-case. */
  header?: string;
  /** Proxies in front of Next.js that append to X-Forwarded-For (1 = the right-most entry). */
  proxyHops: number;
};

/**
 * Where the browser IP comes from (docs/b2-auth.md §7). `CLIENT_IP_HEADER` names a header the
 * edge overwrites; otherwise `TRUSTED_PROXY_HOPS` (default 1) counts the proxies that append to
 * X-Forwarded-For, like the API's TRUST_PROXY. Anything to their left was written by the browser.
 */
export function clientIpSettings(): ClientIpSettings {
  const header = process.env.CLIENT_IP_HEADER?.trim().toLowerCase();
  const hops = Number(process.env.TRUSTED_PROXY_HOPS);
  return {
    ...(header ? { header } : {}),
    proxyHops: Number.isInteger(hops) && hops >= 1 ? hops : 1,
  };
}

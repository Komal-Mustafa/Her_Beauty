import type { HbApi } from './api';
import { createHttpApi } from './http/http-api';
import { mockApi } from './mock/mock-api';

export type { HbApi } from './api';
export { ApiRequestError, createHttpApi } from './http/http-api';
export * from './format';

let httpApi: HbApi | null = null;

/** The API skips its per-IP limits for public reads that carry this key (STOREFRONT_API_KEY). */
export const STOREFRONT_KEY_HEADER = 'x-hb-storefront-key';

/**
 * Single entry point for data. NEXT_PUBLIC_API_MODE=http uses the NestJS API at
 * NEXT_PUBLIC_API_BASE_URL; anything else (default "mock") uses the in-memory fixtures.
 *
 * On the server, the storefront renders every shopper's pages from one IP, so it sends
 * STOREFRONT_API_KEY and the API does not rate-limit those reads as a single client (the edge
 * limits each shopper, security.md §11). The key is server-only: it is not a NEXT_PUBLIC_
 * variable, so it never reaches a browser bundle, and it is never sent from a browser.
 */
export function getApi(): HbApi {
  if (process.env.NEXT_PUBLIC_API_MODE !== 'http') return mockApi;
  if (httpApi) return httpApi;
  const onServer = !('window' in globalThis);
  const key = onServer ? process.env.STOREFRONT_API_KEY : undefined;
  httpApi = createHttpApi({
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/v1',
    ...(key ? { headers: { [STOREFRONT_KEY_HEADER]: key } } : {}),
  });
  return httpApi;
}

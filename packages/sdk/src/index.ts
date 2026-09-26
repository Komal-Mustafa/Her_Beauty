import type { HbApi } from './api';
import { createHttpApi } from './http/http-api';
import { mockApi } from './mock/mock-api';

export type { HbApi } from './api';
export { ApiRequestError, createHttpApi } from './http/http-api';
export * from './format';

let httpApi: HbApi | null = null;

/**
 * Single entry point for data. NEXT_PUBLIC_API_MODE=http uses the NestJS API at
 * NEXT_PUBLIC_API_BASE_URL; anything else (default "mock") uses the in-memory fixtures.
 */
export function getApi(): HbApi {
  if (process.env.NEXT_PUBLIC_API_MODE !== 'http') return mockApi;
  httpApi ??= createHttpApi({
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/v1',
  });
  return httpApi;
}

import type { HbApi } from './api';
import { mockApi } from './mock/mock-api';

export type { HbApi } from './api';
export * from './format';

/**
 * Single entry point for data. NEXT_PUBLIC_API_MODE=mock (default) uses fixtures;
 * the HTTP adapter for the NestJS API is added in the backend track.
 */
export function getApi(): HbApi {
  return mockApi;
}

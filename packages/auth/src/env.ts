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

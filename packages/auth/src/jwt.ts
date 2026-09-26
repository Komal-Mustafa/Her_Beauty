// Reads the `exp` claim of an access token WITHOUT verifying it. Only used to decide whether a
// refresh is worth trying; the API verifies every token (docs/b2-auth.md §7). Edge-safe.

function decodeBase64Url(segment: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) return null;
  const b64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  try {
    return atob(padded);
  } catch {
    return null;
  }
}

/** The token's `exp` (seconds since epoch), or null when it is not a readable JWT. */
export function jwtExpiry(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  const json = decodeBase64Url(parts[1]);
  if (json === null) return null;
  try {
    const payload: unknown = JSON.parse(json);
    if (typeof payload !== 'object' || payload === null) return null;
    const exp = (payload as { exp?: unknown }).exp;
    return typeof exp === 'number' && Number.isFinite(exp) ? exp : null;
  } catch {
    return null;
  }
}

/** Refresh a little early so a token does not expire between the middleware and the API call. */
export const ACCESS_EXPIRY_SKEW_SEC = 30;

/** True when the cookie holds a JWT whose `exp` is more than the skew away. */
export function accessTokenLooksLive(
  token: string | undefined,
  now: number,
  skewSec: number = ACCESS_EXPIRY_SKEW_SEC,
): boolean {
  if (!token) return false;
  const exp = jwtExpiry(token);
  return exp !== null && exp * 1000 - now > skewSec * 1000;
}

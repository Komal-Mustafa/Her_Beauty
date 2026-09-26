// Open-redirect guard for `?next=` values. Edge-safe.

// eslint-disable-next-line no-control-regex -- rejecting control characters is the point
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * Returns `raw` only when it is a same-origin relative path ("/account?tab=x"), else `fallback`.
 * Rejects protocol-relative ("//evil.com"), backslash tricks ("/\\evil.com"), schemes
 * ("javascript:", "https://"), control characters and anything not starting with a single "/".
 */
export function safeNextPath(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const value = raw.trim();
  if (value.length === 0 || value.length > 2048) return fallback;
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback;
  if (value.includes('\\') || CONTROL_CHARS.test(value)) return fallback;
  // Resolve against a throwaway origin: anything that escapes it is not same-origin.
  try {
    const base = 'http://same-origin.invalid';
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

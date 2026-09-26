// Reading helper input from a FormData (server actions) or a plain object.

export type HelperInput = FormData | Record<string, unknown>;

/** String fields only; empty strings become undefined so optional schema fields stay optional. */
export function readInput(input: HelperInput): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  const entries: Iterable<[string, unknown]> =
    input instanceof FormData ? input.entries() : Object.entries(input);
  for (const [key, value] of entries) {
    if (key.startsWith('$ACTION')) continue; // Next.js internals
    if (typeof value === 'string') out[key] = value === '' ? undefined : value;
  }
  return out;
}

/** Copies the listed (non-secret) fields, trimmed, for echoing back into the form. */
export function pickValues(
  data: Record<string, string | undefined>,
  keys: readonly string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of keys) {
    const value = data[key]?.trim();
    if (value) out[key] = value.slice(0, 254);
  }
  return out;
}

/** Turnstile's implicit widget posts `cf-turnstile-response`; typed callers send `captchaToken`. */
export function captchaToken(data: Record<string, string | undefined>): string | undefined {
  return data.captchaToken ?? data['cf-turnstile-response'];
}

/** "a•••@gmail.com" / "+92 300 •••• 567" style masking for display. */
export function maskTarget(target: string, channel: 'sms' | 'email'): string {
  const value = target.trim();
  if (channel === 'email') {
    const at = value.lastIndexOf('@');
    if (at < 1) return '•••';
    return `${value.slice(0, 1)}•••${value.slice(at)}`;
  }
  const digits = value.replace(/[^0-9]/g, '');
  if (digits.length < 4) return '•••';
  return `•••• ${digits.slice(-3)}`;
}

export function channelFor(target: string): 'sms' | 'email' {
  return target.includes('@') ? 'email' : 'sms';
}

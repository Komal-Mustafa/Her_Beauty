/**
 * Awaits data a page can do without (ads, highlights, counters). If the request fails it writes
 * one warning line to the server log and returns `fallback`, so the section hides or falls back
 * (an empty ad slot shows the house card) instead of the whole page failing.
 */
export async function optional<T>(what: string, request: Promise<T>, fallback: T): Promise<T> {
  try {
    return await request;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `${JSON.stringify({ level: 'warn', msg: 'optional page data failed', what, reason })}\n`,
    );
    return fallback;
  }
}

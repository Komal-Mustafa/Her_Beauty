import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/config';
import { invalidCredentials } from './auth-errors';

export const CAPTCHA_FAILURE_LIMIT = 5;
export const CAPTCHA_WINDOW_MS = 15 * 60_000;
const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const SITEVERIFY_TIMEOUT_MS = 5_000;
const MAX_TRACKED_IPS = 50_000;

/**
 * Cloudflare Turnstile after repeated failures (docs/b2-auth.md §4). An IP needs a CAPTCHA once
 * it has 5 failed logins within 15 minutes. The flag is per IP, never per account, so it says
 * nothing about which accounts exist. Without TURNSTILE_SECRET_KEY the check is skipped.
 * The failure window lives in memory (single instance; Redis later).
 */
@Injectable()
export class CaptchaService {
  private readonly log = new Logger(CaptchaService.name);
  private readonly failures = new Map<string, number[]>();

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  get enabled(): boolean {
    return this.config.turnstileSecretKey !== null;
  }

  private recent(ip: string, now = Date.now()): number[] {
    const list = (this.failures.get(ip) ?? []).filter((t) => now - t < CAPTCHA_WINDOW_MS);
    if (list.length) this.failures.set(ip, list);
    else this.failures.delete(ip);
    return list;
  }

  isRequired(ip: string | null): boolean {
    return this.enabled && ip !== null && this.recent(ip).length >= CAPTCHA_FAILURE_LIMIT;
  }

  recordFailure(ip: string | null): void {
    if (!this.enabled || ip === null) return;
    if (!this.failures.has(ip) && this.failures.size >= MAX_TRACKED_IPS) this.prune();
    this.failures.set(ip, [...this.recent(ip), Date.now()]);
  }

  /** Throws 401 INVALID_CREDENTIALS { captchaRequired: true } when a needed token is missing or bad. */
  async assertSolved(ip: string | null, token: string | undefined): Promise<void> {
    if (!this.isRequired(ip)) return;
    if (!token || !(await this.verifyToken(token, ip))) throw invalidCredentials(true);
  }

  /** Turnstile siteverify. Protected so tests can stub the network call. */
  protected async verifyToken(token: string, ip: string | null): Promise<boolean> {
    const secret = this.config.turnstileSecretKey;
    if (!secret) return true;
    const form = new URLSearchParams({ secret, response: token });
    if (ip) form.set('remoteip', ip);
    try {
      const res = await fetch(SITEVERIFY_URL, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
      });
      const body: unknown = await res.json();
      return (
        typeof body === 'object' && body !== null && 'success' in body && body.success === true
      );
    } catch (e) {
      // Fail closed: when we cannot verify, the CAPTCHA is not solved.
      this.log.warn(`Turnstile verify failed: ${e instanceof Error ? e.message : 'error'}`);
      return false;
    }
  }

  /** Bound memory: drop expired windows, then the oldest IPs if still full. */
  private prune() {
    const now = Date.now();
    for (const ip of [...this.failures.keys()]) this.recent(ip, now);
    for (const ip of this.failures.keys()) {
      if (this.failures.size < MAX_TRACKED_IPS) break;
      this.failures.delete(ip);
    }
  }
}

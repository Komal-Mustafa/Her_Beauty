import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { hash, verify, type Algorithm, type Options } from '@node-rs/argon2';
import { PASSWORD_HASH_PARAMS } from '@hb/db';
import { APP_CONFIG, type AppConfig } from '../config/config';
import { weakPassword } from './auth-errors';
import { isCommonPassword } from './common-passwords';

const OPTIONS: Options = {
  ...PASSWORD_HASH_PARAMS,
  algorithm: PASSWORD_HASH_PARAMS.algorithm as Algorithm,
};
const MIN_LENGTH = 8;
const MAX_LENGTH = 128;
const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/';
const HIBP_TIMEOUT_MS = 2_000;

/** Argon2id hashing + password policy (docs/b2-auth.md §4). */
@Injectable()
export class PasswordService implements OnModuleInit {
  private readonly log = new Logger(PasswordService.name);
  private dummyHash = '';

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  /** A real hash of a random throwaway value, so "unknown account" costs a full verify. */
  async onModuleInit() {
    this.dummyHash = await hash(randomBytes(32).toString('base64url'), OPTIONS);
  }

  hash(password: string): Promise<string> {
    return hash(password, OPTIONS);
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      // Malformed stored hash: treat as a mismatch, never as a server error.
      return false;
    }
  }

  /** Burn the same time as a real verify when there is no account (or it is locked). */
  async verifyDummy(password: string): Promise<void> {
    if (!this.dummyHash) await this.onModuleInit();
    await this.verify(this.dummyHash, password);
  }

  /**
   * Throws WEAK_PASSWORD when the password breaks the policy: 8–128 characters, not one of
   * the ~1,000 most common passwords, not the account's own email/phone/name, and — when
   * HIBP_ENABLED — not in the Have I Been Pwned corpus.
   */
  async assertStrong(password: string, personal: (string | null | undefined)[] = []) {
    if (password.length < MIN_LENGTH || password.length > MAX_LENGTH) {
      throw weakPassword(`Use ${MIN_LENGTH} to ${MAX_LENGTH} characters.`);
    }
    if (isCommonPassword(password)) {
      throw weakPassword('That password is too common. Try a longer phrase only you would know.');
    }
    const lower = password.toLowerCase();
    if (personal.some((p) => p && p.trim().length >= 3 && lower === p.trim().toLowerCase())) {
      throw weakPassword('Do not use your email, phone or name as your password.');
    }
    if (this.config.hibpEnabled && (await this.isPwned(password))) {
      throw weakPassword('That password has appeared in a data breach. Choose a different one.');
    }
  }

  /** k-anonymity range query: only the first 5 hex chars of the SHA-1 leave this server. */
  private async isPwned(password: string): Promise<boolean> {
    const sha1 = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);
    try {
      const res = await fetch(`${HIBP_RANGE_URL}${prefix}`, {
        headers: { 'Add-Padding': 'true', 'User-Agent': 'her-beauty-api' },
        signal: AbortSignal.timeout(HIBP_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.text();
      return body.split('\n').some((line) => {
        const [hashSuffix, count] = line.trim().split(':');
        return hashSuffix === suffix && Number(count) > 0;
      });
    } catch (e) {
      // Fail open: an HIBP outage must not stop people from signing up.
      this.log.warn(`HIBP range check skipped: ${e instanceof Error ? e.message : 'error'}`);
      return false;
    }
  }
}

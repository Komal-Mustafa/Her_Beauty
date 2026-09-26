import { Inject, Injectable } from '@nestjs/common';
import { Prisma, uuidv7 } from '@hb/db';
import { hmacSha256Hex, randomDigits, randomToken, safeEqual } from '../common/crypto';
import { APP_CONFIG, type AppConfig } from '../config/config';
import { MESSAGE_PROVIDER, type MessageProvider } from '../messaging/message-provider';
import { PrismaService } from '../prisma/prisma.service';
import { rateLimited } from './auth-errors';
import type { MessageText } from './auth-messages';
import type { Identifier } from './identifiers';

export const OTP_TTL_SEC = 300;
export const OTP_MAX_ATTEMPTS = 3;
export const OTP_SEND_LIMIT = 3;
export const OTP_SEND_WINDOW_MS = 15 * 60_000;
const CODE_DIGITS = 6;

/**
 * otp_codes.purpose values written by B2. "notice" rows only count towards the send limits;
 * "challenge" rows mark used 2FA challenge tokens (no request IP, so they count towards nothing).
 */
export type StoredPurpose = 'login' | 'verify' | 'reset' | 'notice' | 'challenge';

/**
 * A code that matched. `signUp`: the "verify" code sent by the sign-up request itself (hashed
 * under its own label), as opposed to one sent again later with otp/send (docs/b2-auth.md §3).
 */
export interface CheckedCode {
  id: string;
  signUp: boolean;
}

/**
 * One-time codes (docs/b2-auth.md §4): 6 digits, HMAC-SHA256(OTP_PEPPER, purpose|target|code)
 * at rest, 5-minute expiry, 3 tries, single use, newest code wins. Every outbound auth message
 * — including the ones we decide not to send — records one row, so the per-target and per-IP
 * limits (3 per 15 minutes) behave the same whether or not an account exists.
 */
@Injectable()
export class OtpService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(MESSAGE_PROVIDER) private readonly messages: MessageProvider,
  ) {}

  private hash(label: StoredPurpose | 'sign_up', target: string, code: string): string {
    return hmacSha256Hex(this.config.otpPepper, `${label}|${target}|${code}`);
  }

  /** 429 RATE_LIMITED (with details.retryAfterSec) when any target or the IP is over the limit. */
  async assertCanSend(
    targets: string[],
    ip: string | null,
    tx: Prisma.TransactionClient = this.db,
  ): Promise<void> {
    const since = new Date(Date.now() - OTP_SEND_WINDOW_MS);
    const scopes: Prisma.OtpCodeWhereInput[] = targets.map((target) => ({ target }));
    if (ip) scopes.push({ requestIp: ip });
    let retryAfterMs = 0;
    for (const scope of scopes) {
      const rows = await tx.otpCode.findMany({
        where: { ...scope, createdAt: { gt: since } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      });
      // A slot frees up when enough of the oldest sends have left the window.
      const blocking = rows[rows.length - OTP_SEND_LIMIT];
      if (rows.length >= OTP_SEND_LIMIT && blocking) {
        const wait = blocking.createdAt.getTime() + OTP_SEND_WINDOW_MS - Date.now();
        retryAfterMs = Math.max(retryAfterMs, wait);
      }
    }
    if (retryAfterMs > 0) throw rateLimited(Math.max(1, Math.ceil(retryAfterMs / 1000)));
  }

  /**
   * Check the limits and record one send for `target`. With `live` a fresh code replaces any
   * older unused code for the same target + purpose and is returned; otherwise a dead row is
   * written (it can never be verified) and null is returned. `signUp` marks the "verify" code
   * sent by a sign-up request (see CheckedCode).
   */
  async reserve(
    target: string,
    purpose: StoredPurpose,
    ip: string | null,
    live: boolean,
    signUp = false,
  ): Promise<string | null> {
    const code = live ? randomDigits(CODE_DIGITS) : null;
    const now = new Date();
    await this.db.$transaction(async (tx) => {
      // Serialise sends per target and per IP so parallel requests cannot overshoot the limit.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`otp:${target}`}))`;
      if (ip) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`otp-ip:${ip}`}))`;
      await this.assertCanSend([target], ip, tx);
      if (code) {
        await tx.otpCode.updateMany({
          where: { target, purpose, usedAt: null, expiresAt: { gt: now } },
          data: { expiresAt: now },
        });
      }
      await tx.otpCode.create({
        data: {
          id: uuidv7(),
          target,
          purpose,
          codeHash: this.hash(signUp ? 'sign_up' : purpose, target, code ?? randomToken(24)),
          expiresAt: new Date(now.getTime() + OTP_TTL_SEC * 1000),
          usedAt: code ? null : now,
          requestIp: ip,
        },
      });
    });
    return code;
  }

  /**
   * Check a code without consuming it. A wrong code uses up one of the three tries of the
   * newest live code. Returns the row id (to pass to `consume`) and whether it is a sign-up code.
   */
  async check(target: string, purpose: StoredPurpose, code: string): Promise<CheckedCode | null> {
    const row = await this.db.otpCode.findFirst({
      where: {
        target,
        purpose,
        usedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { lt: OTP_MAX_ATTEMPTS },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, codeHash: true },
    });
    if (!row) return null;
    if (safeEqual(row.codeHash, this.hash(purpose, target, code))) {
      return { id: row.id, signUp: false };
    }
    if (purpose === 'verify' && safeEqual(row.codeHash, this.hash('sign_up', target, code))) {
      return { id: row.id, signUp: true };
    }
    await this.db.otpCode.updateMany({
      where: { id: row.id, attempts: { lt: OTP_MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    return null;
  }

  /** Single use: true only for the one caller that marks the code used. */
  async consume(id: string): Promise<boolean> {
    const res = await this.db.otpCode.updateMany({
      where: {
        id,
        usedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { lt: OTP_MAX_ATTEMPTS },
      },
      data: { usedAt: new Date() },
    });
    return res.count === 1;
  }

  async checkAndConsume(
    target: string,
    purpose: StoredPurpose,
    code: string,
  ): Promise<CheckedCode | null> {
    const checked = await this.check(target, purpose, code);
    return checked && (await this.consume(checked.id)) ? checked : null;
  }

  /** Has this challenge token (by jti) already completed a sign-in? */
  async isChallengeUsed(userId: string, jti: string): Promise<boolean> {
    const row = await this.db.otpCode.findFirst({
      where: { purpose: 'challenge', codeHash: this.hash('challenge', userId, jti) },
      select: { id: true },
    });
    return row !== null;
  }

  /**
   * Mark a challenge token used, kept until it expires. False when it was already used: a
   * partial unique index on code_hash (purpose 'challenge') lets only one racing request win.
   */
  async useChallenge(userId: string, jti: string, expiresAt: Date): Promise<boolean> {
    try {
      await this.db.otpCode.create({
        data: {
          id: uuidv7(),
          target: userId,
          purpose: 'challenge',
          codeHash: this.hash('challenge', userId, jti),
          expiresAt,
          usedAt: new Date(),
        },
      });
      return true;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return false;
      throw e;
    }
  }

  async deliver(to: Identifier, message: MessageText): Promise<void> {
    if (to.kind === 'email') await this.messages.sendEmail(to.value, message.subject, message.text);
    else await this.messages.sendSms(to.value, message.text);
  }
}

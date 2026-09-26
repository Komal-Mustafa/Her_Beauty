import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Secret, TOTP } from 'otpauth';
import { uuidv7, type Prisma, type User } from '@hb/db';
import type { TwoFactorSetup } from '@hb/types';
import { AuditService } from '../audit/audit.service';
import type { ClientContext } from '../common/client';
import {
  decrypt,
  encrypt,
  generateBackupCode,
  hmacSha256Hex,
  normaliseBackupCode,
} from '../common/crypto';
import { APP_CONFIG, type AppConfig } from '../config/config';
import { PrismaService } from '../prisma/prisma.service';
import { conflict } from './auth-errors';

// RFC 6238 TOTP (docs/b2-auth.md §4): SHA-1, 6 digits, 30 s steps, ±1 step, issuer "Her Beauty".
const TOTP_ISSUER = 'Her Beauty';
const TOTP_ALGORITHM = 'SHA1';
const TOTP_DIGITS = 6;
const TOTP_PERIOD = 30;
const TOTP_WINDOW = 1;
const SECRET_BYTES = 20;
export const BACKUP_CODE_COUNT = 10;

/**
 * TOTP secrets are stored AES-256-GCM encrypted (users.twofa_secret_enc) with the user id as
 * associated data, so a ciphertext copied onto another account does not decrypt. The last
 * accepted time-step is kept in users.twofa_last_step: a code for that step or an earlier one
 * is a replay and is rejected.
 */
@Injectable()
export class TwoFactorService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  private aad(userId: string) {
    return `twofa:${userId}`;
  }

  private totp(user: Pick<User, 'id' | 'email' | 'phone'>, secret: Secret): TOTP {
    return new TOTP({
      issuer: TOTP_ISSUER,
      label: user.email ?? user.phone ?? user.id,
      algorithm: TOTP_ALGORITHM,
      digits: TOTP_DIGITS,
      period: TOTP_PERIOD,
      secret,
    });
  }

  private hashBackupCode(normalised: string): string {
    return hmacSha256Hex(this.config.otpPepper, normalised);
  }

  /** Create (or replace a not-yet-enabled) secret. Never replaces an enabled one. */
  async setup(user: User): Promise<TwoFactorSetup> {
    if (user.twofaEnabledAt) throw conflict('Two-factor authentication is already on.');
    const raw = randomBytes(SECRET_BYTES);
    const updated = await this.db.user.updateMany({
      where: { id: user.id, twofaEnabledAt: null },
      data: {
        twofaSecretEnc: Uint8Array.from(encrypt(this.config.encryptionKey, raw, this.aad(user.id))),
        twofaLastStep: null,
      },
    });
    if (updated.count !== 1) throw conflict('Two-factor authentication is already on.');
    const secret = new Secret({ buffer: Uint8Array.from(raw).buffer });
    return { secret: secret.base32, otpauthUri: this.totp(user, secret).toString() };
  }

  /** Accepts a current TOTP code once: replays of the same or an older step fail. */
  async verifyTotp(user: User, code: string): Promise<boolean> {
    if (!user.twofaSecretEnc || !/^[0-9]{6}$/.test(code)) return false;
    let raw: Buffer;
    try {
      raw = decrypt(this.config.encryptionKey, user.twofaSecretEnc, this.aad(user.id));
    } catch {
      return false;
    }
    const secret = new Secret({ buffer: Uint8Array.from(raw).buffer });
    const now = Date.now();
    const delta = this.totp(user, secret).validate({
      token: code,
      timestamp: now,
      window: TOTP_WINDOW,
    });
    if (delta === null) return false;
    const step = BigInt(TOTP.counter({ period: TOTP_PERIOD, timestamp: now }) + delta);
    const accepted = await this.db.user.updateMany({
      where: { id: user.id, OR: [{ twofaLastStep: null }, { twofaLastStep: { lt: step } }] },
      data: { twofaLastStep: step },
    });
    return accepted.count === 1;
  }

  /** Single use: marks the code used in the same statement that finds it. */
  async useBackupCode(userId: string, code: string): Promise<boolean> {
    const normalised = normaliseBackupCode(code);
    if (!normalised) return false;
    const used = await this.db.twofaBackupCode.updateMany({
      where: { userId, codeHash: this.hashBackupCode(normalised), usedAt: null },
      data: { usedAt: new Date() },
    });
    return used.count === 1;
  }

  /** A 6-digit TOTP code or a backup code, for users with 2FA enabled. */
  async verifySecondFactor(user: User, code: string): Promise<boolean> {
    if (!user.twofaEnabledAt) return false;
    const trimmed = code.trim();
    return /^[0-9]{6}$/.test(trimmed)
      ? this.verifyTotp(user, trimmed)
      : this.useBackupCode(user.id, trimmed);
  }

  /**
   * Confirm the first code and switch 2FA on. Returns the 10 backup codes (shown once), or
   * null when the code is wrong.
   */
  async enable(user: User, code: string, client: ClientContext): Promise<string[] | null> {
    if (user.twofaEnabledAt) throw conflict('Two-factor authentication is already on.');
    if (!(await this.verifyTotp(user, code))) return null;
    const codes = Array.from({ length: BACKUP_CODE_COUNT }, generateBackupCode);
    await this.db.$transaction(async (tx) => {
      const on = await tx.user.updateMany({
        where: { id: user.id, twofaEnabledAt: null },
        data: { twofaEnabledAt: new Date() },
      });
      if (on.count !== 1) throw conflict('Two-factor authentication is already on.');
      await this.replaceBackupCodes(tx, user.id, codes);
      await this.audit.record(
        {
          action: 'auth.2fa_enabled',
          actorId: user.id,
          actorRole: user.role,
          targetType: 'user',
          targetId: user.id,
          ip: client.ip,
        },
        tx,
      );
    });
    return codes;
  }

  async disable(user: User, client: ClientContext): Promise<void> {
    await this.db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { twofaSecretEnc: null, twofaEnabledAt: null, twofaLastStep: null },
      });
      await tx.twofaBackupCode.deleteMany({ where: { userId: user.id } });
      await this.audit.record(
        {
          action: 'auth.2fa_disabled',
          actorId: user.id,
          actorRole: user.role,
          targetType: 'user',
          targetId: user.id,
          ip: client.ip,
        },
        tx,
      );
    });
  }

  private async replaceBackupCodes(tx: Prisma.TransactionClient, userId: string, codes: string[]) {
    await tx.twofaBackupCode.deleteMany({ where: { userId } });
    await tx.twofaBackupCode.createMany({
      data: codes.map((c) => ({
        id: uuidv7(),
        userId,
        codeHash: this.hashBackupCode(normaliseBackupCode(c) ?? c),
      })),
    });
  }
}

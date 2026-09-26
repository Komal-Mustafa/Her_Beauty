import { Inject, Injectable } from '@nestjs/common';
import type { User } from '@hb/db';
import { AuditService } from '../audit/audit.service';
import type { ClientContext } from '../common/client';
import { MESSAGE_PROVIDER, type MessageProvider } from '../messaging/message-provider';
import { PrismaService } from '../prisma/prisma.service';
import { lockNotice } from './auth-messages';

export const LOCK_AFTER_FAILURES = 5;
export const MAX_LOCK_MINUTES = 60;

/** Minutes locked after the n-th consecutive failure: min(2^(n-5), 60) from the 5th on. */
export const lockMinutes = (failures: number) =>
  failures < LOCK_AFTER_FAILURES
    ? 0
    : Math.min(2 ** (failures - LOCK_AFTER_FAILURES), MAX_LOCK_MINUTES);

/** Outcome of one counted attempt; `value` is what the check returned. */
export type AttemptResult<T> =
  | { status: 'ok'; value: T }
  | { status: 'failed' }
  | { status: 'locked' };

/** A failure slot taken before a check runs (see `attempt`). */
interface Reservation {
  userId: string;
  failedLogins: number;
  /** > 0 when taking this slot locked the account. */
  minutes: number;
  /** locked_until before this slot (restored when a slot that locked is given back). */
  previousLock: Date | null;
}

/**
 * Account lockout (docs/b2-auth.md §4). Every failed password or 2FA attempt counts; from the
 * 5th consecutive failure the account is locked with exponential back-off, the owner gets one
 * notice per lock, and `auth.locked` is audited. A full successful login resets the counter.
 *
 * Attempts are counted **before** the password or code is checked, under a row lock, so
 * parallel guesses cannot all be checked against a stale "not locked" snapshot: the attempt
 * that reaches the threshold locks the account at once, and later ones are refused unchecked.
 */
@Injectable()
export class LockoutService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(MESSAGE_PROVIDER) private readonly messages: MessageProvider,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  isLocked(user: Pick<User, 'lockedUntil'>): boolean {
    return user.lockedUntil !== null && user.lockedUntil.getTime() > Date.now();
  }

  /**
   * Run one password or second-factor check as a counted attempt. `check` resolves to a value
   * on success and to null on a wrong password/code. The failure is counted before `check`
   * runs and given back when it succeeds (or throws). While the account is locked `check`
   * does not run and nothing is counted.
   */
  async attempt<T>(
    user: User,
    client: ClientContext,
    check: () => Promise<T | null>,
  ): Promise<AttemptResult<T>> {
    const slot = await this.reserve(user.id);
    if (!slot) return { status: 'locked' };
    let value: T | null;
    try {
      value = await check();
    } catch (e) {
      await this.release(slot);
      throw e;
    }
    if (value === null) {
      await this.lockedBy(user, slot, client);
      return { status: 'failed' };
    }
    await this.release(slot);
    return { status: 'ok', value };
  }

  /** Count a failure now and, if it reaches the threshold, lock at once. Null when locked. */
  private reserve(userId: string): Promise<Reservation | null> {
    return this.db.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<{ failedLogins: number; lockedUntil: Date | null }[]>`
        SELECT failed_logins AS "failedLogins", locked_until AS "lockedUntil"
        FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
      if (!row || this.isLocked(row)) return null;
      const failedLogins = row.failedLogins + 1;
      const minutes = lockMinutes(failedLogins);
      await tx.user.update({
        where: { id: userId },
        data: {
          failedLogins,
          ...(minutes > 0 ? { lockedUntil: new Date(Date.now() + minutes * 60_000) } : {}),
        },
      });
      return { userId, failedLogins, minutes, previousLock: row.lockedUntil };
    });
  }

  /**
   * The check passed: give the slot back. While a slot that locked is out, no other attempt
   * can take one, so restoring the earlier locked_until undoes exactly this slot's lock.
   */
  private async release(slot: Reservation): Promise<void> {
    await this.db.$executeRaw`
      UPDATE users
      SET failed_logins = GREATEST(failed_logins - 1, 0),
          locked_until = CASE WHEN ${slot.minutes > 0} THEN ${slot.previousLock}::timestamptz
                              ELSE locked_until END
      WHERE id = ${slot.userId}::uuid`;
  }

  /** The check failed: if this failure locked the account, audit it and tell the owner once. */
  private async lockedBy(user: User, slot: Reservation, client: ClientContext): Promise<void> {
    const { failedLogins, minutes } = slot;
    if (minutes === 0) return;
    await this.audit.record({
      action: 'auth.locked',
      actorId: user.id,
      actorRole: user.role,
      targetType: 'user',
      targetId: user.id,
      ip: client.ip,
      meta: { failedLogins, minutes },
    });
    const notice = lockNotice(minutes);
    if (user.email) await this.messages.sendEmail(user.email, notice.subject, notice.text);
    else if (user.phone) await this.messages.sendSms(user.phone, notice.text);
  }

  async recordSuccess(userId: string): Promise<void> {
    await this.db.user.update({
      where: { id: userId },
      data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
  }
}

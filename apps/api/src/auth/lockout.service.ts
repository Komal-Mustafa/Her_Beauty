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

/**
 * Account lockout (docs/b2-auth.md §4). Every failed password or 2FA attempt counts; from the
 * 5th consecutive failure the account is locked with exponential back-off, the owner gets one
 * notice per lock, and `auth.locked` is audited. A full successful login resets the counter.
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

  async recordFailure(user: User, client: ClientContext): Promise<void> {
    const { failedLogins } = await this.db.user.update({
      where: { id: user.id },
      data: { failedLogins: { increment: 1 } },
      select: { failedLogins: true },
    });
    const minutes = lockMinutes(failedLogins);
    if (minutes === 0) return;
    await this.db.user.update({
      where: { id: user.id },
      data: { lockedUntil: new Date(Date.now() + minutes * 60_000) },
    });
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

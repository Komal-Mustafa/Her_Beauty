import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma, UserRole } from '@hb/db';
import { PrismaService } from '../prisma/prisma.service';

/** Actions written by B2 (docs/b2-auth.md §5). */
export type AuditAction =
  | 'auth.login'
  | 'auth.login_failed'
  | 'auth.locked'
  | 'auth.refresh_reuse'
  | 'auth.logout_all'
  | 'auth.password_reset'
  | 'auth.2fa_enabled'
  | 'auth.2fa_disabled'
  | 'seller.application_started';

export interface AuditEntry {
  action: AuditAction;
  actorId?: string | null;
  actorRole?: UserRole | null;
  targetType: 'user' | 'session' | 'seller';
  targetId?: string | null;
  ip?: string | null;
  /** Context only — never passwords, codes, tokens, secrets or full identifiers. */
  meta?: Prisma.InputJsonObject;
}

@Injectable()
export class AuditService {
  private readonly log = new Logger(AuditService.name);

  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async record(entry: AuditEntry, tx: Prisma.TransactionClient = this.db): Promise<void> {
    await tx.auditLog.create({
      data: {
        action: entry.action,
        actorId: entry.actorId ?? null,
        actorRole: entry.actorRole ?? null,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        ip: entry.ip ?? null,
        meta: entry.meta ?? {},
      },
    });
    this.log.log(`${entry.action} ${entry.targetType}:${entry.targetId ?? '-'}`);
  }
}

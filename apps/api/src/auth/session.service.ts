import { Inject, Injectable } from '@nestjs/common';
import { uuidv7, type Session } from '@hb/db';
import type { AuthAudience, SessionInfo } from '@hb/types';
import { AuditService } from '../audit/audit.service';
import type { ClientContext } from '../common/client';
import { hmacSha256Hex, randomToken } from '../common/crypto';
import { APP_CONFIG, type AppConfig } from '../config/config';
import { PrismaService } from '../prisma/prisma.service';

/** Refresh lifetime per app, absolute from login (docs/b2-auth.md §1). */
export const REFRESH_TTL_MS: Record<AuthAudience, number> = {
  web: 30 * 86_400_000,
  seller: 7 * 86_400_000,
  admin: 12 * 3_600_000,
};

/** How stale `last_used_at` may get before a request writes it again. */
const TOUCH_INTERVAL_MS = 60_000;

/**
 * A token rotated away less than this long ago is a concurrent refresh (two tabs, a retried
 * request), not a stolen token: it gets a plain 401 and nothing else is revoked.
 */
export const REUSE_GRACE_MS = 10_000;

/** Why a session row was revoked (`sessions.revoked_reason`, CHECK in migration SQL). */
export type RevokeReason =
  | 'rotated'
  | 'logout'
  | 'logout_all'
  | 'device_revoked'
  | 'password_reset'
  | 'reuse'
  | 'access_lost'
  | 'account_claimed';

export interface IssuedSession {
  session: Session;
  refreshToken: string;
}

export type RotateResult =
  | { kind: 'ok'; session: Session; refreshToken: string }
  | { kind: 'unknown' }
  | { kind: 'expired' }
  /** Rotated away within REUSE_GRACE_MS: a concurrent refresh. */
  | { kind: 'superseded' }
  /** Revoked on purpose (logout, one device signed out, password reset, ...). */
  | { kind: 'revoked' }
  | { kind: 'reuse' };

/**
 * Refresh-token sessions (docs/b2-auth.md §2). Only HMAC-SHA256(REFRESH_TOKEN_PEPPER, token)
 * is stored. Every refresh rotates: the used row is revoked (reason "rotated") and a new row
 * joins the family with the same audience, absolute expiry and mfa_at. Presenting a token that
 * was rotated away more than REUSE_GRACE_MS ago revokes every session of that user (reuse
 * detection, security.md §4); a token revoked for any other reason just gets a 401.
 */
@Injectable()
export class SessionService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  hashToken(token: string): string {
    return hmacSha256Hex(this.config.refreshTokenPepper, token);
  }

  async create(input: {
    userId: string;
    audience: AuthAudience;
    mfa: boolean;
    client: ClientContext;
  }): Promise<IssuedSession> {
    const refreshToken = randomToken(32);
    const now = new Date();
    const session = await this.db.session.create({
      data: {
        id: uuidv7(),
        userId: input.userId,
        familyId: uuidv7(),
        refreshTokenHash: this.hashToken(refreshToken),
        audience: input.audience,
        mfaAt: input.mfa ? now : null,
        lastUsedAt: now,
        userAgent: input.client.userAgent,
        ip: input.client.ip,
        expiresAt: new Date(now.getTime() + REFRESH_TTL_MS[input.audience]),
      },
    });
    return { session, refreshToken };
  }

  /** Refresh: look the token up, rotate, or work out why it can no longer be used. */
  async rotate(refreshToken: string, client: ClientContext): Promise<RotateResult> {
    const current = await this.db.session.findUnique({
      where: { refreshTokenHash: this.hashToken(refreshToken) },
    });
    if (!current) return { kind: 'unknown' };
    // An expired family is dead anyway: an old token of it never signs the user out elsewhere.
    if (current.expiresAt <= new Date()) return { kind: 'expired' };
    if (!current.revokedAt) {
      const next = await this.replace(current, client);
      if (next) return { kind: 'ok', ...next };
    }
    // Revoked before, or concurrently (lost a race with another use of the same token).
    const revoked = current.revokedAt
      ? current
      : await this.db.session.findUnique({ where: { id: current.id } });
    return this.whyRevoked(revoked ?? current, client);
  }

  /** Only a token rotated away more than REUSE_GRACE_MS ago is treated as stolen. */
  private async whyRevoked(session: Session, client: ClientContext): Promise<RotateResult> {
    if (session.revokedReason !== 'rotated' || !session.revokedAt) return { kind: 'revoked' };
    if (Date.now() - session.revokedAt.getTime() < REUSE_GRACE_MS) return { kind: 'superseded' };
    await this.handleReuse(session, client);
    return { kind: 'reuse' };
  }

  /**
   * Revoke `current` and insert its successor in one transaction. Returns null when `current`
   * was revoked concurrently. Used by refresh and when new claims must be issued (a seller
   * application adds the seller context).
   */
  async replace(current: Session, client: ClientContext): Promise<IssuedSession | null> {
    const refreshToken = randomToken(32);
    const now = new Date();
    return this.db.$transaction(async (tx) => {
      const revoked = await tx.session.updateMany({
        where: { id: current.id, revokedAt: null },
        data: { revokedAt: now, revokedReason: 'rotated' },
      });
      if (revoked.count !== 1) return null;
      const session = await tx.session.create({
        data: {
          id: uuidv7(),
          userId: current.userId,
          familyId: current.familyId,
          refreshTokenHash: this.hashToken(refreshToken),
          audience: current.audience,
          mfaAt: current.mfaAt,
          lastUsedAt: now,
          userAgent: client.userAgent ?? current.userAgent,
          ip: client.ip ?? current.ip,
          expiresAt: current.expiresAt,
        },
      });
      return { session, refreshToken };
    });
  }

  private async handleReuse(session: Session, client: ClientContext) {
    const revoked = await this.revokeAll(session.userId, 'reuse');
    await this.audit.record({
      action: 'auth.refresh_reuse',
      actorId: session.userId,
      targetType: 'session',
      targetId: session.id,
      ip: client.ip,
      meta: { familyId: session.familyId, audience: session.audience, revoked },
    });
  }

  /** Logout: revoke the session that owns this refresh token (unknown tokens are ignored). */
  async revokeByToken(refreshToken: string): Promise<void> {
    await this.db.session.updateMany({
      where: { refreshTokenHash: this.hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'logout' },
    });
  }

  /** Revoke one of the user's own sessions. False when no such session belongs to the user. */
  async revokeOwn(userId: string, sessionId: string, reason: RevokeReason): Promise<boolean> {
    const found = await this.db.session.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    });
    if (!found) return false;
    await this.db.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    return true;
  }

  async revokeAll(userId: string, reason: RevokeReason): Promise<number> {
    const res = await this.db.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    return res.count;
  }

  async list(userId: string, currentSessionId: string): Promise<SessionInfo[]> {
    const rows = await this.db.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: [{ lastUsedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: 100,
    });
    return rows.map((s) => ({
      id: s.id,
      audience: s.audience as AuthAudience,
      userAgent: s.userAgent,
      ip: s.ip,
      createdAt: s.createdAt.toISOString(),
      lastUsedAt: s.lastUsedAt?.toISOString() ?? null,
      current: s.id === currentSessionId,
    }));
  }

  async findActive(sessionId: string) {
    return this.db.session.findFirst({
      where: { id: sessionId, revokedAt: null, expiresAt: { gt: new Date() } },
    });
  }

  /** Record activity without writing on every single request. */
  async touch(sessionId: string, lastUsedAt: Date | null): Promise<void> {
    const now = Date.now();
    if (lastUsedAt && now - lastUsedAt.getTime() < TOUCH_INTERVAL_MS) return;
    await this.db.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { lastUsedAt: new Date(now) },
    });
  }

  async markMfa(sessionId: string): Promise<void> {
    await this.db.session.updateMany({
      where: { id: sessionId, revokedAt: null, mfaAt: null },
      data: { mfaAt: new Date() },
    });
  }
}

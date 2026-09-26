import { Inject, Injectable } from '@nestjs/common';
import type { Session, User } from '@hb/db';
import {
  ADMIN_ROLES,
  type AuthAudience,
  type LoginResult,
  type TokenPair,
  type UserRole,
} from '@hb/types';
import { AuditService } from '../audit/audit.service';
import type { ClientContext } from '../common/client';
import { UsersService } from '../users/users.service';
import { LockoutService } from './lockout.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

export type LoginOk = Extract<LoginResult, { status: 'ok' }>;

/** Admin app: admin-ish roles only. Web and seller apps: any active user (docs/b2-auth.md §1). */
export const audienceAllows = (audience: AuthAudience | string, role: UserRole): boolean =>
  audience !== 'admin' || (ADMIN_ROLES as readonly UserRole[]).includes(role);

/** Shared end of every login path: password, OTP, 2FA challenge, admin enrolment. */
@Injectable()
export class SignInService {
  constructor(
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(LockoutService) private readonly lockout: LockoutService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /** First factor passed: finish, or ask for the second factor / 2FA enrolment. */
  async afterFirstFactor(
    user: User,
    audience: AuthAudience,
    client: ClientContext,
  ): Promise<LoginResult> {
    if (user.twofaEnabledAt) {
      const c = await this.tokens.signChallenge('mfa', audience, user.id);
      return { status: 'mfa_required', challengeToken: c.token, expiresInSec: c.expiresInSec };
    }
    if (audience === 'admin') {
      const c = await this.tokens.signChallenge('mfa_setup', audience, user.id);
      return {
        status: 'mfa_setup_required',
        challengeToken: c.token,
        expiresInSec: c.expiresInSec,
      };
    }
    return this.finish(user, audience, client, false);
  }

  /** Full success: reset the failure counter, open a session, return tokens + profile. */
  async finish(
    user: User,
    audience: AuthAudience,
    client: ClientContext,
    mfa: boolean,
  ): Promise<LoginOk> {
    await this.lockout.recordSuccess(user.id);
    const { session, refreshToken } = await this.sessions.create({
      userId: user.id,
      audience,
      mfa,
      client,
    });
    if (audience === 'admin') {
      await this.audit.record({
        action: 'auth.login',
        actorId: user.id,
        actorRole: user.role,
        targetType: 'session',
        targetId: session.id,
        ip: client.ip,
        meta: { audience, mfa },
      });
    }
    const tokens = await this.tokenPair(session, refreshToken, user.role);
    return { status: 'ok', tokens, user: await this.users.me(user.id) };
  }

  /** Access token for a session row; seller context is read fresh at issue time. */
  async tokenPair(session: Session, refreshToken: string, role: UserRole): Promise<TokenPair> {
    const audience = session.audience as AuthAudience;
    const seller = audience === 'seller' ? await this.users.sellerContext(session.userId) : null;
    const access = await this.tokens.signAccess({
      userId: session.userId,
      sessionId: session.id,
      audience,
      role,
      mfa: session.mfaAt !== null,
      ...(seller ?? {}),
    });
    return {
      accessToken: access.token,
      accessExpiresAt: access.expiresAt.toISOString(),
      refreshToken,
      refreshExpiresAt: session.expiresAt.toISOString(),
    };
  }
}

import { Inject, Injectable } from '@nestjs/common';
import type { User } from '@hb/db';
import {
  ADMIN_ROLES,
  type AuthAudience,
  type LoginResult,
  type TwoFactorChallengeRequest,
  type TwoFactorDisableRequest,
  type TwoFactorEnabled,
  type TwoFactorEnableRequest,
  type TwoFactorSetup,
  type UserRole,
} from '@hb/types';
import { AuditService } from '../audit/audit.service';
import type { ClientContext } from '../common/client';
import { UsersService } from '../users/users.service';
import type { AuthContext } from './auth-context';
import {
  conflict,
  forbidden,
  invalidCode,
  invalidCredentials,
  unauthenticated,
} from './auth-errors';
import { LockoutService } from './lockout.service';
import { OtpService } from './otp.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { audienceAllows, SignInService } from './sign-in.service';
import {
  InvalidTokenError,
  TokenService,
  type ChallengeClaimsOut,
  type ChallengeType,
} from './token.service';
import { TwoFactorService } from './two-factor.service';

/** A verified, not yet used challenge token (docs/b2-auth.md §3). */
interface Challenge {
  user: User;
  audience: AuthAudience;
  jti: string;
  expiresAt: Date;
}

/** Who is doing a 2FA step: a signed-in user, or someone half-way through an admin login. */
type Actor = { via: 'bearer'; user: User; auth: AuthContext } | ({ via: 'challenge' } & Challenge);

const expiredChallenge = () => unauthenticated('Your sign-in expired. Please sign in again.');

/** 2FA endpoints (docs/b2-auth.md §3): challenge, setup, enable, disable. */
@Injectable()
export class MfaService {
  constructor(
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(TwoFactorService) private readonly twoFactor: TwoFactorService,
    @Inject(LockoutService) private readonly lockout: LockoutService,
    @Inject(OtpService) private readonly otp: OtpService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(SignInService) private readonly signIn: SignInService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /** Finish a login with a TOTP or backup code. Each wrong code counts as a failed login. */
  async challenge(body: TwoFactorChallengeRequest, client: ClientContext): Promise<LoginResult> {
    const challenge = await this.fromChallenge(body.challengeToken, 'mfa');
    const { user, audience } = challenge;
    if (!user.twofaEnabledAt) throw invalidCredentials();
    if (!(await this.twoFactor.verifySecondFactor(user, body.code))) {
      await this.failSecondFactor(user, audience, client);
    }
    await this.useChallenge(challenge);
    return this.signIn.finish(user, audience, client, true);
  }

  async setup(
    challengeToken: string | undefined,
    auth: AuthContext | undefined,
  ): Promise<TwoFactorSetup> {
    const actor = await this.actor(challengeToken, auth);
    return this.twoFactor.setup(actor.user);
  }

  /** Confirm the first code. With a setup challenge token this also completes the login. */
  async enable(
    body: TwoFactorEnableRequest,
    auth: AuthContext | undefined,
    client: ClientContext,
  ): Promise<TwoFactorEnabled> {
    const actor = await this.actor(body.challengeToken, auth);
    const backupCodes = await this.twoFactor.enable(actor.user, body.code, client);
    if (!backupCodes) {
      if (actor.via === 'challenge')
        await this.failSecondFactor(actor.user, actor.audience, client);
      throw invalidCode();
    }
    if (actor.via === 'bearer') {
      await this.sessions.markMfa(actor.auth.sessionId);
      return { backupCodes };
    }
    await this.useChallenge(actor);
    const login = await this.signIn.finish(actor.user, actor.audience, client, true);
    return { backupCodes, login };
  }

  /** Needs the password and a current code. Admin accounts can never switch 2FA off. */
  async disable(
    body: TwoFactorDisableRequest,
    auth: AuthContext,
    client: ClientContext,
  ): Promise<void> {
    const user = await this.users.findActiveById(auth.userId);
    if (!user) throw unauthenticated();
    if ((ADMIN_ROLES as readonly UserRole[]).includes(user.role)) {
      throw forbidden('Admin accounts must keep two-factor authentication on.');
    }
    if (!user.twofaEnabledAt) throw conflict('Two-factor authentication is not on.');
    if (this.lockout.isLocked(user)) throw invalidCredentials();
    const passwordOk =
      user.passwordHash !== null && (await this.passwords.verify(user.passwordHash, body.password));
    if (!passwordOk) {
      await this.lockout.recordFailure(user, client);
      throw invalidCredentials();
    }
    if (!(await this.twoFactor.verifySecondFactor(user, body.code))) {
      await this.lockout.recordFailure(user, client);
      throw invalidCode();
    }
    await this.twoFactor.disable(user, client);
  }

  private async actor(
    challengeToken: string | undefined,
    auth: AuthContext | undefined,
  ): Promise<Actor> {
    if (challengeToken) {
      return { via: 'challenge', ...(await this.fromChallenge(challengeToken, 'mfa_setup')) };
    }
    if (!auth) throw unauthenticated();
    const user = await this.users.findActiveById(auth.userId);
    if (!user) throw unauthenticated();
    return { via: 'bearer', user, auth };
  }

  /**
   * Verify a challenge token, refuse one that already completed a sign-in, and re-check the
   * account: still active, unlocked, allowed in.
   */
  private async fromChallenge(token: string, typ: ChallengeType): Promise<Challenge> {
    let claims: ChallengeClaimsOut;
    try {
      claims = await this.tokens.verifyChallenge(token, typ);
    } catch (e) {
      if (e instanceof InvalidTokenError) throw expiredChallenge();
      throw e;
    }
    if (await this.otp.isChallengeUsed(claims.userId, claims.jti)) throw expiredChallenge();
    const user = await this.users.findActiveById(claims.userId);
    if (!user || this.lockout.isLocked(user) || !audienceAllows(claims.audience, user.role)) {
      throw invalidCredentials();
    }
    return { user, audience: claims.audience, jti: claims.jti, expiresAt: claims.expiresAt };
  }

  /** A challenge token completes one sign-in only; a racing second completion is refused. */
  private async useChallenge(c: Challenge): Promise<void> {
    if (!(await this.otp.useChallenge(c.user.id, c.jti, c.expiresAt))) throw expiredChallenge();
  }

  private async failSecondFactor(
    user: User,
    audience: AuthAudience,
    client: ClientContext,
  ): Promise<never> {
    await this.lockout.recordFailure(user, client);
    if (audience === 'admin') {
      await this.audit.record({
        action: 'auth.login_failed',
        actorId: user.id,
        actorRole: user.role,
        targetType: 'user',
        targetId: user.id,
        ip: client.ip,
        meta: { audience, reason: 'second_factor' },
      });
    }
    throw invalidCode();
  }
}

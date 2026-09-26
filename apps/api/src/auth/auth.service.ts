import { Inject, Injectable } from '@nestjs/common';
import { Prisma, uuidv7, type User } from '@hb/db';
import type {
  CodeSent,
  ForgotPasswordRequest,
  LoginRequest,
  LoginResult,
  OtpSendRequest,
  OtpVerifyRequest,
  RegisterRequest,
  ResetPasswordRequest,
  TokenPair,
  VerificationSent,
} from '@hb/types';
import { AuditService } from '../audit/audit.service';
import type { ClientContext } from '../common/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import type { AuthContext } from './auth-context';
import {
  forbidden,
  invalidCode,
  invalidCredentials,
  profileRequired,
  sessionRevoked,
  unauthenticated,
  validationFailed,
} from './auth-errors';
import { codeMessage, signUpNotice } from './auth-messages';
import { CaptchaService } from './captcha.service';
import {
  channelOf,
  identifierWhere,
  maskIdentifier,
  normaliseEmail,
  normalisePhone,
  parseIdentifier,
  parseTarget,
  type Identifier,
} from './identifiers';
import { LockoutService } from './lockout.service';
import { OTP_TTL_SEC, OtpService } from './otp.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { audienceAllows, SignInService } from './sign-in.service';

const OTP_TTL_MIN = OTP_TTL_SEC / 60;
const CODE_SENT: CodeSent = { status: 'sent', expiresInSec: OTP_TTL_SEC };

type PasswordCheck = 'ok' | 'no_account' | 'locked' | 'wrong' | 'unverified';

const isVerified = (user: User, id: Identifier) =>
  (id.kind === 'email' ? user.emailVerifiedAt : user.phoneVerifiedAt) !== null;

const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

/** Registration, OTP, password login, refresh/logout and password reset (docs/b2-auth.md §3–4). */
@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(OtpService) private readonly otp: OtpService,
    @Inject(CaptchaService) private readonly captcha: CaptchaService,
    @Inject(LockoutService) private readonly lockout: LockoutService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(SignInService) private readonly signIn: SignInService,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  // ---------- registration ----------

  /**
   * Always 202 with the same body, whether or not the address is taken (no enumeration).
   * New account: unverified user (+ draft seller for the seller app) and a verify code.
   * Taken address: a "someone tried to sign up" notice instead. The password is hashed in both
   * cases so the response time does not tell them apart either.
   */
  async register(body: RegisterRequest, client: ClientContext): Promise<VerificationSent> {
    const ids = this.registrationIdentifiers(body);
    const primary = ids.find((i) => i.kind === 'email') ?? ids[0];
    if (!primary) throw validationFailed('email', 'Enter an email address or a mobile number');
    await this.passwords.assertStrong(body.password, [...ids.map((i) => i.value), body.fullName]);
    await this.otp.assertCanSend(
      ids.map((i) => i.value),
      client.ip,
    );
    const passwordHash = await this.passwords.hash(body.password);

    const taken = await this.takenIdentifiers(ids);
    const created =
      taken.length === 0 && (await this.createAccount(body, ids, passwordHash, client));
    if (created) {
      const code = await this.otp.reserve(primary.value, 'verify', client.ip, true);
      if (code) await this.otp.deliver(primary, codeMessage('verify', code, OTP_TTL_MIN));
    } else {
      const notify = taken.length ? taken : await this.takenIdentifiers(ids);
      for (const id of notify) {
        await this.otp.reserve(id.value, 'notice', client.ip, false);
        await this.otp.deliver(id, signUpNotice);
      }
    }
    return {
      status: 'verification_sent',
      channel: channelOf(primary),
      target: maskIdentifier(primary),
    };
  }

  private registrationIdentifiers(body: RegisterRequest): Identifier[] {
    const ids: Identifier[] = [];
    if (body.email) {
      const email = normaliseEmail(body.email);
      if (!email) throw validationFailed('email', 'Enter a valid email address');
      ids.push({ kind: 'email', value: email });
    }
    if (body.phone) {
      const phone = normalisePhone(body.phone);
      if (!phone) throw validationFailed('phone', 'Enter a mobile number like 0300 1234567');
      ids.push({ kind: 'phone', value: phone });
    }
    return ids;
  }

  private async takenIdentifiers(ids: Identifier[]): Promise<Identifier[]> {
    const rows = await this.db.user.findMany({
      where: { OR: ids.map(identifierWhere) },
      select: { email: true, phone: true },
    });
    return ids.filter((i) =>
      rows.some((r) => (i.kind === 'email' ? r.email === i.value : r.phone === i.value)),
    );
  }

  /** False when the address was taken concurrently (unique violation). */
  private async createAccount(
    body: RegisterRequest,
    ids: Identifier[],
    passwordHash: string,
    client: ClientContext,
  ): Promise<boolean> {
    const userId = uuidv7();
    try {
      await this.db.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            id: userId,
            email: ids.find((i) => i.kind === 'email')?.value ?? null,
            phone: ids.find((i) => i.kind === 'phone')?.value ?? null,
            fullName: body.fullName,
            passwordHash,
            role: body.audience === 'seller' ? 'seller' : 'customer',
          },
        });
        if (body.audience !== 'seller') return;
        const sellerId = uuidv7();
        await tx.seller.create({
          data: {
            id: sellerId,
            ownerUserId: userId,
            type: body.sellerType,
            status: 'draft',
            storeName: body.storeName,
            members: { create: { userId, role: 'owner' } },
          },
        });
        await this.audit.record(
          {
            action: 'seller.application_started',
            actorId: userId,
            actorRole: 'seller',
            targetType: 'seller',
            targetId: sellerId,
            ip: client.ip,
            meta: { type: body.sellerType, via: 'register' },
          },
          tx,
        );
      });
      return true;
    } catch (e) {
      if (isUniqueViolation(e)) return false;
      throw e;
    }
  }

  // ---------- one-time codes ----------

  /** Always 202. Codes only go where they can be used; every request counts towards the limits. */
  async sendOtp(body: OtpSendRequest, client: ClientContext): Promise<CodeSent> {
    const target = parseTarget(body.channel, body.target);
    if (body.purpose === 'login' && body.audience !== 'web') {
      throw forbidden('Sign-in with a code is only available in the shop.');
    }
    const user = await this.users.findByIdentifier(target);
    const active = user !== null && user.status === 'active';
    // "login": existing accounts, and new numbers/emails (the account is created on verify).
    // "verify": only accounts that still need this address verified.
    const live =
      body.purpose === 'login' ? user === null || active : active && !isVerified(user, target);
    const code = await this.otp.reserve(target.value, body.purpose, client.ip, live);
    if (code) await this.otp.deliver(target, codeMessage(body.purpose, code, OTP_TTL_MIN));
    return CODE_SENT;
  }

  async verifyOtp(body: OtpVerifyRequest, client: ClientContext): Promise<LoginResult> {
    const target = parseTarget(body.channel, body.target);
    return body.purpose === 'login'
      ? this.otpLogin(body, target, client)
      : this.otpVerify(body, target, client);
  }

  /** purpose "verify": completes registration — marks the address verified and logs in. */
  private async otpVerify(body: OtpVerifyRequest, target: Identifier, client: ClientContext) {
    if (!(await this.otp.checkAndConsume(target.value, 'verify', body.code))) throw invalidCode();
    const found = await this.users.findByIdentifier(target);
    if (!found || found.status !== 'active') throw invalidCode();
    const user = await this.markVerified(found, target, false);
    if (!audienceAllows(body.audience, user.role) || this.lockout.isLocked(user)) {
      throw invalidCredentials();
    }
    return this.signIn.afterFirstFactor(user, body.audience, client);
  }

  /**
   * purpose "login" (shop only). A right code for an address without an account answers
   * 422 PROFILE_REQUIRED and stays usable; resubmitting with fullName creates the customer.
   * The code is checked first so PROFILE_REQUIRED never reveals whether an account exists.
   */
  private async otpLogin(body: OtpVerifyRequest, target: Identifier, client: ClientContext) {
    if (body.audience !== 'web')
      throw forbidden('Sign-in with a code is only available in the shop.');
    const codeId = await this.otp.check(target.value, 'login', body.code);
    if (!codeId) throw invalidCode();
    const found = await this.users.findByIdentifier(target);
    if (!found && !body.fullName) throw profileRequired();
    if (!(await this.otp.consume(codeId))) throw invalidCode();
    let user: User;
    if (found) {
      if (found.status !== 'active' || this.lockout.isLocked(found)) throw invalidCredentials();
      user = await this.markVerified(found, target, true);
    } else {
      user = await this.createCodeCustomer(target, body.fullName ?? '');
    }
    return this.signIn.afterFirstFactor(user, 'web', client);
  }

  private async createCodeCustomer(target: Identifier, fullName: string): Promise<User> {
    try {
      return await this.db.user.create({
        data: {
          id: uuidv7(),
          fullName,
          role: 'customer',
          ...(target.kind === 'email'
            ? { email: target.value, emailVerifiedAt: new Date() }
            : { phone: target.value, phoneVerifiedAt: new Date() }),
        },
      });
    } catch (e) {
      // The address belongs to an account we cannot sign into (e.g. a deleted one).
      if (isUniqueViolation(e)) throw invalidCredentials();
      throw e;
    }
  }

  /**
   * Record that the owner of `target` proved possession of it. On a code login into an account
   * that had never been verified, the password is dropped: whoever set it never proved they own
   * the address, and keeping it would let them into the real owner's account (pre-hijacking).
   */
  private async markVerified(user: User, target: Identifier, codeLogin: boolean): Promise<User> {
    if (isVerified(user, target)) return user;
    const neverVerified = user.emailVerifiedAt === null && user.phoneVerifiedAt === null;
    const now = new Date();
    return this.db.user.update({
      where: { id: user.id },
      data: {
        ...(target.kind === 'email' ? { emailVerifiedAt: now } : { phoneVerifiedAt: now }),
        ...(codeLogin && neverVerified ? { passwordHash: null } : {}),
      },
    });
  }

  // ---------- password login ----------

  async login(body: LoginRequest, client: ClientContext): Promise<LoginResult> {
    await this.captcha.assertSolved(client.ip, body.captchaToken);
    const id = parseIdentifier(body.identifier);
    const user = await this.users.findByIdentifier(id);
    const check = await this.checkPassword(user, id, body.password, client);
    if (check !== 'ok' || !user) return this.failLogin(user, body.audience, client, check);
    if (!audienceAllows(body.audience, user.role)) {
      return this.failLogin(user, body.audience, client, 'audience');
    }
    return this.signIn.afterFirstFactor(user, body.audience, client);
  }

  /** Unknown and locked accounts still pay for one Argon2 verify (timing, docs §4). */
  private async checkPassword(
    user: User | null,
    id: Identifier,
    password: string,
    client: ClientContext,
  ): Promise<PasswordCheck> {
    const hash = user?.passwordHash;
    if (!user || !hash || user.status !== 'active') {
      await this.passwords.verifyDummy(password);
      return 'no_account';
    }
    const result = this.lockout.isLocked(user)
      ? ({ status: 'locked' } as const)
      : await this.lockout.attempt(user, client, async () =>
          (await this.passwords.verify(hash, password)) ? true : null,
        );
    if (result.status === 'locked') {
      await this.passwords.verifyDummy(password);
      return 'locked';
    }
    if (result.status === 'failed') return 'wrong';
    // A password only works with an address its owner has proven (registration completes on verify).
    return isVerified(user, id) ? 'ok' : 'unverified';
  }

  private async failLogin(
    user: User | null,
    audience: LoginRequest['audience'],
    client: ClientContext,
    reason: PasswordCheck | 'audience',
  ): Promise<never> {
    this.captcha.recordFailure(client.ip);
    if (audience === 'admin') {
      await this.audit.record({
        action: 'auth.login_failed',
        actorId: user?.id ?? null,
        actorRole: user?.role ?? null,
        targetType: 'user',
        targetId: user?.id ?? null,
        ip: client.ip,
        meta: { audience, reason },
      });
    }
    throw invalidCredentials(this.captcha.isRequired(client.ip));
  }

  // ---------- refresh / logout ----------

  async refresh(refreshToken: string, client: ClientContext): Promise<TokenPair> {
    const result = await this.sessions.rotate(refreshToken, client);
    if (result.kind === 'reuse' || result.kind === 'revoked') throw sessionRevoked();
    // unknown, expired, or superseded by a concurrent refresh (nothing else is revoked).
    if (result.kind !== 'ok')
      throw unauthenticated('Your session has ended. Please sign in again.');
    const user = await this.users.findActiveById(result.session.userId);
    if (!user || !audienceAllows(result.session.audience, user.role)) {
      await this.sessions.revokeOwn(result.session.userId, result.session.id, 'access_lost');
      throw sessionRevoked();
    }
    return this.signIn.tokenPair(result.session, result.refreshToken, user.role);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.sessions.revokeByToken(refreshToken);
  }

  async logoutAll(auth: AuthContext, client: ClientContext): Promise<void> {
    const revoked = await this.sessions.revokeAll(auth.userId, 'logout_all');
    await this.audit.record({
      action: 'auth.logout_all',
      actorId: auth.userId,
      actorRole: auth.role,
      targetType: 'user',
      targetId: auth.userId,
      ip: client.ip,
      meta: { revoked, audience: auth.audience },
    });
  }

  // ---------- password reset ----------

  /** Always 202; a reset code only goes to an existing active account. */
  async forgotPassword(body: ForgotPasswordRequest, client: ClientContext): Promise<CodeSent> {
    const id = parseIdentifier(body.identifier);
    const user = await this.users.findByIdentifier(id);
    const live = user !== null && user.status === 'active';
    const code = await this.otp.reserve(id.value, 'reset', client.ip, live);
    if (code) await this.otp.deliver(id, codeMessage('reset', code, OTP_TTL_MIN));
    return CODE_SENT;
  }

  /** New password, lock cleared, address verified, every session revoked. */
  async resetPassword(body: ResetPasswordRequest, client: ClientContext): Promise<void> {
    const id = parseIdentifier(body.identifier);
    await this.passwords.assertStrong(body.newPassword, [body.identifier, id.value]);
    const valid = await this.otp.checkAndConsume(id.value, 'reset', body.code);
    const user = valid ? await this.users.findByIdentifier(id) : null;
    if (!user || user.status !== 'active') throw invalidCode();
    const passwordHash = await this.passwords.hash(body.newPassword);
    const now = new Date();
    await this.db.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        failedLogins: 0,
        lockedUntil: null,
        ...(id.kind === 'email'
          ? { emailVerifiedAt: user.emailVerifiedAt ?? now }
          : { phoneVerifiedAt: user.phoneVerifiedAt ?? now }),
      },
    });
    const revoked = await this.sessions.revokeAll(user.id, 'password_reset');
    await this.audit.record({
      action: 'auth.password_reset',
      actorId: user.id,
      actorRole: user.role,
      targetType: 'user',
      targetId: user.id,
      ip: client.ip,
      meta: { revokedSessions: revoked },
    });
  }
}

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

/**
 * How an account holds an identifier (docs/b2-auth.md §3): "verified" (its owner proved it),
 * "unclaimed" (nobody has proven any identifier of the account yet: sign-up not finished) or
 * "stray" (unverified on an account whose owner proved another one; only in data from before
 * pending_phone). A stray identifier is never a credential.
 */
type Standing = 'verified' | 'unclaimed' | 'stray';
const standing = (user: User, id: Identifier): Standing => {
  if (isVerified(user, id)) return 'verified';
  return user.emailVerifiedAt === null && user.phoneVerifiedAt === null ? 'unclaimed' : 'stray';
};

/**
 * Who is proving an address of an unclaimed account, as far as the API can tell:
 * - "sign_up": the code the sign-up request itself sent, and nobody disputed the sign-up since;
 * - "someone": anything else — a verify code sent again later (possibly to someone who never
 *   signed up), a disputed sign-up, a code login or a password reset.
 */
type Claimant = 'sign_up' | 'someone';

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
   * Only the primary identifier (the email, else the mobile number) is bound to the account and
   * gets a message. A mobile number given next to an email is only remembered (`pending_phone`):
   * it is not an identifier until verified, so it can be neither claimed nor probed here.
   * New account: unverified user (+ draft seller for the seller app) and a verify code.
   * Taken address: a "someone tried to sign up" notice instead, and if the account holding it
   * was never verified its sign-up password is dropped (`dispute`). Exactly one send is recorded
   * either way and the password is hashed in both cases, so neither the limits nor the response
   * time tell them apart.
   */
  async register(body: RegisterRequest, client: ClientContext): Promise<VerificationSent> {
    const { primary, pendingPhone } = this.registrationIdentifiers(body);
    await this.passwords.assertStrong(body.password, [
      primary.value,
      ...(pendingPhone ? [pendingPhone] : []),
      body.fullName,
    ]);
    await this.otp.assertCanSend([primary.value], client.ip);
    const passwordHash = await this.passwords.hash(body.password);

    // Soft-deleted accounts still hold their address (unique), so they count as taken.
    const taken = await this.db.user.findFirst({
      where: identifierWhere(primary),
      select: { id: true },
    });
    const created =
      !taken && (await this.createAccount(body, primary, pendingPhone, passwordHash, client));
    if (created) {
      const code = await this.otp.reserve(primary.value, 'verify', client.ip, true, true);
      if (code) await this.otp.deliver(primary, codeMessage('verify', code, OTP_TTL_MIN));
    } else {
      await this.dispute(primary);
      await this.otp.reserve(primary.value, 'notice', client.ip, false);
      await this.otp.deliver(primary, signUpNotice);
    }
    return {
      status: 'verification_sent',
      channel: channelOf(primary),
      target: maskIdentifier(primary),
    };
  }

  /** The primary identifier (email, else mobile number) and a mobile number kept for later. */
  private registrationIdentifiers(body: RegisterRequest): {
    primary: Identifier;
    pendingPhone: string | null;
  } {
    const email = body.email ? normaliseEmail(body.email) : null;
    if (body.email && !email) throw validationFailed('email', 'Enter a valid email address');
    const phone = body.phone ? normalisePhone(body.phone) : null;
    if (body.phone && !phone) {
      throw validationFailed('phone', 'Enter a mobile number like 0300 1234567');
    }
    if (email) return { primary: { kind: 'email', value: email }, pendingPhone: phone };
    if (phone) return { primary: { kind: 'phone', value: phone }, pendingPhone: null };
    throw validationFailed('email', 'Enter an email address or a mobile number');
  }

  /**
   * Someone else is signing up with an address held by an account that was never verified.
   * Either of the two may be its real owner, so the password chosen at the first sign-up is no
   * longer trusted: it is dropped, and whoever proves the address signs in without one
   * (and sets one with "forgot password"). Stops registration pre-hijacking.
   */
  private async dispute(id: Identifier): Promise<void> {
    await this.db.user.updateMany({
      where: { ...identifierWhere(id), emailVerifiedAt: null, phoneVerifiedAt: null },
      data: { passwordHash: null },
    });
  }

  /** False when the address was taken concurrently (unique violation). */
  private async createAccount(
    body: RegisterRequest,
    primary: Identifier,
    pendingPhone: string | null,
    passwordHash: string,
    client: ClientContext,
  ): Promise<boolean> {
    const userId = uuidv7();
    try {
      await this.db.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            id: userId,
            ...identifierWhere(primary),
            pendingPhone,
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
    const held = user && standing(user, target);
    // "login": existing accounts, and new numbers/emails (the account is created on verify).
    // "verify": only the address of an account whose sign-up is not finished. A second address
    // of an established account is never proven here (that would sign its holder in).
    const live =
      body.purpose === 'login'
        ? user === null || (active && held !== 'stray')
        : active && held === 'unclaimed';
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

  /**
   * purpose "verify": finishes a sign-up — marks the address verified and logs in. Only for an
   * account nobody has verified yet. The sign-up password is kept only with the code the sign-up
   * sent, while undisputed; a code sent again may reach someone who never signed up.
   */
  private async otpVerify(body: OtpVerifyRequest, target: Identifier, client: ClientContext) {
    const checked = await this.otp.checkAndConsume(target.value, 'verify', body.code);
    if (!checked) throw invalidCode();
    const found = await this.users.findByIdentifier(target);
    if (!found || found.status !== 'active' || standing(found, target) !== 'unclaimed') {
      throw invalidCode();
    }
    const undisputed = found.passwordHash !== null;
    const claimant: Claimant = undisputed && checked.signUp ? 'sign_up' : 'someone';
    const user = await this.claim(found, target, claimant);
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
    const checked = await this.otp.check(target.value, 'login', body.code);
    if (!checked) throw invalidCode();
    const found = await this.users.findByIdentifier(target);
    if (!found && !body.fullName) throw profileRequired();
    if (!(await this.otp.consume(checked.id))) throw invalidCode();
    let user: User;
    if (found) {
      if (found.status !== 'active' || this.lockout.isLocked(found)) throw invalidCredentials();
      const held = standing(found, target);
      if (held === 'stray') throw invalidCredentials();
      user = held === 'unclaimed' ? await this.claim(found, target, 'someone') : found;
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
   * First proof of an address on an unclaimed account (docs/b2-auth.md §3). Unless the prover is
   * the sign-up's own author (`sign_up`), what the sign-up chose is not trusted: the password,
   * any 2FA, any session and the pending mobile number are dropped. Whoever signs up with
   * somebody else's address therefore keeps no way in once the real owner proves it
   * (pre-hijacking), and their number can never be confirmed into the account.
   */
  private async claim(user: User, target: Identifier, claimant: Claimant): Promise<User> {
    const now = new Date();
    const verified = target.kind === 'email' ? { emailVerifiedAt: now } : { phoneVerifiedAt: now };
    if (claimant === 'sign_up') {
      return this.db.user.update({ where: { id: user.id }, data: verified });
    }
    const claimed = await this.db.$transaction(async (tx) => {
      await tx.twofaBackupCode.deleteMany({ where: { userId: user.id } });
      return tx.user.update({
        where: { id: user.id },
        data: {
          ...verified,
          passwordHash: null,
          twofaSecretEnc: null,
          twofaEnabledAt: null,
          twofaLastStep: null,
          pendingPhone: null,
        },
      });
    });
    await this.sessions.revokeAll(user.id, 'account_claimed');
    return claimed;
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

  /**
   * Always 202. A reset code only goes to an address an active account's owner proved, or to
   * the address of an account whose sign-up is not finished (resetting then claims it).
   */
  async forgotPassword(body: ForgotPasswordRequest, client: ClientContext): Promise<CodeSent> {
    const id = parseIdentifier(body.identifier);
    const user = await this.users.findByIdentifier(id);
    const live = user !== null && user.status === 'active' && standing(user, id) !== 'stray';
    const code = await this.otp.reserve(id.value, 'reset', client.ip, live);
    if (code) await this.otp.deliver(id, codeMessage('reset', code, OTP_TTL_MIN));
    return CODE_SENT;
  }

  /**
   * New password, lock cleared, address verified, every session revoked. On an account whose
   * sign-up was not finished this is a claim: what the sign-up chose is dropped first.
   */
  async resetPassword(body: ResetPasswordRequest, client: ClientContext): Promise<void> {
    const id = parseIdentifier(body.identifier);
    await this.passwords.assertStrong(body.newPassword, [body.identifier, id.value]);
    const valid = await this.otp.checkAndConsume(id.value, 'reset', body.code);
    const user = valid ? await this.users.findByIdentifier(id) : null;
    if (!user || user.status !== 'active') throw invalidCode();
    const held = standing(user, id);
    if (held === 'stray') throw invalidCode();
    if (held === 'unclaimed') await this.claim(user, id, 'someone');
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

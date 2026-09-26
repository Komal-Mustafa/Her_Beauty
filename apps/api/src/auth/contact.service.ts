import { Inject, Injectable } from '@nestjs/common';
import { Prisma, type User } from '@hb/db';
import type { CodeSent, ContactSendRequest, ContactVerifyRequest, Me, OtpChannel } from '@hb/types';
import { AuditService } from '../audit/audit.service';
import type { ClientContext } from '../common/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import type { AuthContext } from './auth-context';
import { conflict, invalidCode, unauthenticated, validationFailed } from './auth-errors';
import { codeMessage, identifierAddedNotice } from './auth-messages';
import { maskIdentifier, type Identifier } from './identifiers';
import { OTP_TTL_SEC, OtpService } from './otp.service';

const CODE_SENT: CodeSent = { status: 'sent', expiresInSec: OTP_TTL_SEC };

/** The address being confirmed; `pending`: the mobile number given at sign-up (pending_phone). */
type Unconfirmed = Identifier & { pending: boolean };

/**
 * A signed-in user confirms the email or mobile number already on their account
 * (docs/b2-auth.md §3 "Confirming a contact"). The address always comes from the account, and the
 * code is bound to the account as well as the address, so it proves this user holds it. A
 * confirmed address becomes a sign-in identifier, and the account's other confirmed address is
 * told. A number another account already holds is refused (409) only after its code was right, so
 * the check cannot be used to probe numbers.
 */
@Injectable()
export class ContactService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(OtpService) private readonly otp: OtpService,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async send(
    body: ContactSendRequest,
    auth: AuthContext,
    client: ClientContext,
  ): Promise<CodeSent> {
    const user = await this.activeUser(auth);
    const address = unconfirmed(user, body.channel);
    const code = await this.otp.reserve(address.value, 'contact', client.ip, true, false, user.id);
    if (code) await this.otp.deliver(address, codeMessage('contact', code, OTP_TTL_SEC / 60));
    return CODE_SENT;
  }

  async verify(body: ContactVerifyRequest, auth: AuthContext, client: ClientContext): Promise<Me> {
    const user = await this.activeUser(auth);
    const address = unconfirmed(user, body.channel);
    const checked = await this.otp.checkAndConsume(address.value, 'contact', body.code, user.id);
    if (!checked) throw invalidCode();
    const now = new Date();
    // Only while the account still holds this address unconfirmed (it may have changed since).
    const where: Prisma.UserWhereInput =
      address.kind === 'email'
        ? { id: user.id, email: address.value, emailVerifiedAt: null }
        : address.pending
          ? { id: user.id, phone: null, pendingPhone: address.value }
          : { id: user.id, phone: address.value, phoneVerifiedAt: null };
    const data: Prisma.UserUpdateManyMutationInput =
      address.kind === 'email'
        ? { emailVerifiedAt: now }
        : address.pending
          ? { phone: address.value, pendingPhone: null, phoneVerifiedAt: now }
          : { phoneVerifiedAt: now };
    try {
      await this.db.$transaction(async (tx) => {
        const { count } = await tx.user.updateMany({ where, data });
        if (count !== 1) throw invalidCode();
        await this.audit.record(
          {
            action: 'auth.contact_verified',
            actorId: user.id,
            actorRole: user.role,
            targetType: 'user',
            targetId: user.id,
            ip: client.ip,
            meta: { channel: body.channel, masked: maskIdentifier(address) },
          },
          tx,
        );
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw conflict(
          'This mobile number is already used by another Her Beauty account. Log in with it, or contact support.',
        );
      }
      throw e;
    }
    const other = confirmedOther(user, address.kind);
    if (other) {
      await this.otp.deliver(other, identifierAddedNotice(address.kind, maskIdentifier(address)));
    }
    return this.users.me(user.id);
  }

  private async activeUser(auth: AuthContext): Promise<User> {
    const user = await this.users.findActiveById(auth.userId);
    if (!user) throw unauthenticated();
    return user;
  }
}

/** The account's confirmed address of the other kind, if any (where the notice goes). */
function confirmedOther(user: User, kind: Identifier['kind']): Identifier | null {
  if (kind === 'phone' && user.email && user.emailVerifiedAt) {
    return { kind: 'email', value: user.email };
  }
  if (kind === 'email' && user.phone && user.phoneVerifiedAt) {
    return { kind: 'phone', value: user.phone };
  }
  return null;
}

/** The account's own address on `channel` that still needs confirming. */
function unconfirmed(user: User, channel: OtpChannel): Unconfirmed {
  if (channel === 'email') {
    if (!user.email)
      throw validationFailed('channel', 'There is no email address on your account.');
    if (user.emailVerifiedAt) throw conflict('Your email address is already confirmed.');
    return { kind: 'email', value: user.email, pending: false };
  }
  if (user.phone) {
    if (user.phoneVerifiedAt) throw conflict('Your mobile number is already confirmed.');
    return { kind: 'phone', value: user.phone, pending: false };
  }
  if (user.pendingPhone) return { kind: 'phone', value: user.pendingPhone, pending: true };
  throw validationFailed('channel', 'There is no mobile number on your account.');
}

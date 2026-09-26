import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthAudience, SellerMemberRole, UserRole } from '@hb/types';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthContext, AuthedRequest } from './auth-context';
import { forbidden, mfaRequired, sessionRevoked, unauthenticated } from './auth-errors';
import {
  AUDIENCES,
  IS_PUBLIC,
  OPTIONAL_AUTH,
  REQUIRE_MFA,
  ROLES,
  SELLER_ROLES,
} from './decorators';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

type Targets = [
  ReturnType<ExecutionContext['getHandler']>,
  ReturnType<ExecutionContext['getClass']>,
];

/**
 * Global, default-deny (docs/b2-auth.md §5). A route is either @Public() or needs a valid
 * access token whose session row is still live — so logout and "log out everywhere" apply at
 * once — and then passes the @Audiences / @Roles / @RequireMfa / @SellerRoles checks.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return false;
    const targets: Targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = bearerToken(req.get('authorization'));
    if (!token) {
      if (this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH, targets)) return true;
      throw unauthenticated();
    }
    req.auth = await this.authenticate(token);
    this.authorize(req.auth, targets);
    return true;
  }

  private async authenticate(token: string): Promise<AuthContext> {
    let auth: AuthContext;
    try {
      auth = await this.tokens.verifyAccess(token);
    } catch {
      throw unauthenticated();
    }
    const session = await this.db.session.findUnique({
      where: { id: auth.sessionId },
      select: {
        userId: true,
        audience: true,
        revokedAt: true,
        expiresAt: true,
        lastUsedAt: true,
        user: { select: { status: true, deletedAt: true } },
      },
    });
    if (!session || session.userId !== auth.userId || session.audience !== auth.audience) {
      throw unauthenticated();
    }
    const dead =
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= Date.now() ||
      session.user.status !== 'active' ||
      session.user.deletedAt !== null;
    if (dead) throw sessionRevoked();
    await this.sessions.touch(auth.sessionId, session.lastUsedAt);
    return auth;
  }

  private authorize(auth: AuthContext, targets: Targets): void {
    const audiences = this.reflector.getAllAndOverride<AuthAudience[] | undefined>(
      AUDIENCES,
      targets,
    );
    if (audiences && !audiences.includes(auth.audience)) throw forbidden();
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES, targets);
    if (roles && !roles.includes(auth.role)) throw forbidden();
    if (this.reflector.getAllAndOverride<boolean>(REQUIRE_MFA, targets) && !auth.mfa) {
      throw mfaRequired();
    }
    const sellerRoles = this.reflector.getAllAndOverride<SellerMemberRole[] | undefined>(
      SELLER_ROLES,
      targets,
    );
    if (sellerRoles) {
      if (!auth.sellerId || !auth.sellerRole) throw forbidden('This needs a seller account.');
      if (sellerRoles.length && !sellerRoles.includes(auth.sellerRole)) throw forbidden();
    }
  }
}

function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+([A-Za-z0-9_\-.]+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

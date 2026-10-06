import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthAudience, SellerMemberRole, UserRole } from '@hb/types';
import type { AuthContext, AuthedRequest } from './auth-context';
import { unauthenticated } from './auth-errors';

// Route metadata read by the global AuthGuard (docs/b2-auth.md §5). Default = deny.

export const IS_PUBLIC = 'hb:auth:public';
export const OPTIONAL_AUTH = 'hb:auth:optional';
export const AUDIENCES = 'hb:auth:audiences';
export const ROLES = 'hb:auth:roles';
export const REQUIRE_MFA = 'hb:auth:mfa';
export const SELLER_ROLES = 'hb:auth:sellerRoles';

/** No access token needed. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/**
 * A bearer token is optional; when one is sent it must be valid. For endpoints that accept
 * either a bearer token or a challenge token in the body (2FA setup / enable).
 */
export const OptionalAuth = () => SetMetadata(OPTIONAL_AUTH, true);

/** Only tokens issued for these apps. */
export const Audiences = (...audiences: AuthAudience[]) => SetMetadata(AUDIENCES, audiences);

/** Only these user roles. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES, roles);

/** The session must have completed 2FA (`mfa: true`), else 403 MFA_REQUIRED. */
export const RequireMfa = () => SetMetadata(REQUIRE_MFA, true);

/**
 * The token must carry a seller context. With roles, the member role must be one of them;
 * without, any member of the seller passes.
 */
export const SellerRoles = (...roles: SellerMemberRole[]) => SetMetadata(SELLER_ROLES, roles);

/** security.md: the global per-IP limit of every route that sets none of its own. */
export const DEFAULT_PER_MINUTE = 300;

/** Per-IP limit for this route (docs/b2-auth.md §3), on top of the global default. */
export const PerMinute = (limit: number) => Throttle({ default: { limit, ttl: 60_000 } });

/** `@CurrentAuth() auth: AuthContext` — set by the AuthGuard. */
export const CurrentAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const auth = ctx.switchToHttp().getRequest<AuthedRequest>().auth;
    if (!auth) throw unauthenticated();
    return auth;
  },
);

/** `@MaybeAuth() auth: AuthContext | undefined` — for @OptionalAuth routes. */
export const MaybeAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext | undefined =>
    ctx.switchToHttp().getRequest<AuthedRequest>().auth,
);

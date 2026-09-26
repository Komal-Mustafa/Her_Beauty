import { Inject, Injectable } from '@nestjs/common';
import { jwtVerify, SignJWT, type JWTPayload } from 'jose';
import { z } from 'zod';
import { uuidv7 } from '@hb/db';
import { AuthAudience, SellerMemberRole, UserRole } from '@hb/types';
import { APP_CONFIG, type AppConfig } from '../config/config';
import type { AuthContext } from './auth-context';

// docs/b2-auth.md §2–3: EdDSA (Ed25519) access tokens (15 min) and challenge tokens (5 min).

export const ISSUER = 'herbeauty-api';
export const ACCESS_TOKEN_TTL_SEC = 15 * 60;
export const CHALLENGE_TOKEN_TTL_SEC = 5 * 60;
const ALG = 'EdDSA';
const AUDIENCES = AuthAudience.options;

export type ChallengeType = 'mfa' | 'mfa_setup';

export class InvalidTokenError extends Error {
  override name = 'InvalidTokenError';
}

const AccessClaims = z.object({
  sub: z.uuid(),
  aud: AuthAudience,
  sid: z.uuid(),
  role: UserRole,
  mfa: z.boolean(),
  sel: z.uuid().optional(),
  srole: SellerMemberRole.optional(),
});

const ChallengeClaims = z.object({
  sub: z.uuid(),
  aud: AuthAudience,
  typ: z.enum(['mfa', 'mfa_setup']),
  jti: z.string().min(1).max(64),
  exp: z.number().int(),
});

/** A verified challenge token. `jti` + `expiresAt` let the caller make it single use. */
export interface ChallengeClaimsOut {
  userId: string;
  audience: AuthAudience;
  jti: string;
  expiresAt: Date;
}

export interface AccessTokenInput {
  userId: string;
  sessionId: string;
  audience: AuthAudience;
  role: UserRole;
  mfa: boolean;
  sellerId?: string;
  sellerRole?: SellerMemberRole;
}

@Injectable()
export class TokenService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async signAccess(input: AccessTokenInput): Promise<{ token: string; expiresAt: Date }> {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + ACCESS_TOKEN_TTL_SEC;
    const claims: JWTPayload = { sid: input.sessionId, role: input.role, mfa: input.mfa };
    if (input.sellerId) {
      claims.sel = input.sellerId;
      claims.srole = input.sellerRole;
    }
    const token = await new SignJWT(claims)
      .setProtectedHeader({ alg: ALG, typ: 'JWT' })
      .setIssuer(ISSUER)
      .setAudience(input.audience)
      .setSubject(input.userId)
      .setIssuedAt(now)
      .setExpirationTime(exp)
      .setJti(uuidv7())
      .sign(this.config.jwt.privateKey);
    return { token, expiresAt: new Date(exp * 1000) };
  }

  /** Access tokens only: anything carrying a `typ` claim (challenge tokens) is rejected. */
  async verifyAccess(token: string): Promise<AuthContext> {
    const payload = await this.verify(token);
    if ('typ' in payload) throw new InvalidTokenError('not an access token');
    const parsed = AccessClaims.safeParse(payload);
    if (!parsed.success) throw new InvalidTokenError('malformed claims');
    const c = parsed.data;
    return {
      userId: c.sub,
      sessionId: c.sid,
      role: c.role,
      audience: c.aud,
      mfa: c.mfa,
      ...(c.sel ? { sellerId: c.sel, sellerRole: c.srole } : {}),
    };
  }

  async signChallenge(
    typ: ChallengeType,
    audience: AuthAudience,
    userId: string,
  ): Promise<{ token: string; expiresInSec: number }> {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ typ })
      .setProtectedHeader({ alg: ALG, typ: 'JWT' })
      .setIssuer(ISSUER)
      .setAudience(audience)
      .setSubject(userId)
      .setIssuedAt(now)
      .setExpirationTime(now + CHALLENGE_TOKEN_TTL_SEC)
      .setJti(uuidv7())
      .sign(this.config.jwt.privateKey);
    return { token, expiresInSec: CHALLENGE_TOKEN_TTL_SEC };
  }

  async verifyChallenge(token: string, typ: ChallengeType): Promise<ChallengeClaimsOut> {
    const parsed = ChallengeClaims.safeParse(await this.verify(token));
    if (!parsed.success || parsed.data.typ !== typ) {
      throw new InvalidTokenError('not a challenge token of this type');
    }
    const c = parsed.data;
    return { userId: c.sub, audience: c.aud, jti: c.jti, expiresAt: new Date(c.exp * 1000) };
  }

  private async verify(token: string): Promise<JWTPayload> {
    try {
      const { payload } = await jwtVerify(token, this.config.jwt.publicKey, {
        issuer: ISSUER,
        audience: [...AUDIENCES],
        algorithms: [ALG],
        requiredClaims: ['sub', 'exp', 'iat', 'jti'],
      });
      // A token must name exactly one app.
      if (typeof payload.aud !== 'string') throw new InvalidTokenError('audience must be single');
      return payload;
    } catch (e) {
      if (e instanceof InvalidTokenError) throw e;
      throw new InvalidTokenError('signature, expiry or claims check failed');
    }
  }
}

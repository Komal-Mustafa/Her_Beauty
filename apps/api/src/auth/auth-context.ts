import type { Request } from 'express';
import type { AuthAudience, SellerMemberRole, UserRole } from '@hb/types';

/** What the AuthGuard puts on the request (docs/b2-auth.md §5 `@CurrentAuth()`). */
export interface AuthContext {
  userId: string;
  sessionId: string;
  role: UserRole;
  audience: AuthAudience;
  /** 2FA was completed for this session. */
  mfa: boolean;
  /** Seller context — only ever from the token (seller audience), never from the request. */
  sellerId?: string;
  sellerRole?: SellerMemberRole;
}

export type AuthedRequest = Request & { auth?: AuthContext };

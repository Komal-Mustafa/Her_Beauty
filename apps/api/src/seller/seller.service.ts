import { Inject, Injectable } from '@nestjs/common';
import { uuidv7 } from '@hb/db';
import type {
  Paged,
  SellerProductRow,
  SellerProfile,
  StartSellerApplicationRequest,
  TokenPair,
} from '@hb/types';
import type { AuthContext } from '../auth/auth-context';
import { conflict, forbidden, sessionRevoked, unauthenticated } from '../auth/auth-errors';
import { SessionService } from '../auth/session.service';
import { SignInService } from '../auth/sign-in.service';
import { AuditService } from '../audit/audit.service';
import type { ClientContext } from '../common/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

export const SELLER_PRODUCTS_DEFAULT_LIMIT = 50;
export const SELLER_PRODUCTS_MAX_LIMIT = 100;

const encodeCursor = (offset: number) => Buffer.from(`o:${offset}`).toString('base64url');
function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  const raw = Buffer.from(cursor, 'base64url').toString();
  const n = raw.startsWith('o:') ? Number.parseInt(raw.slice(2), 10) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

const alreadySeller = () => conflict('You already have a seller account.');

/**
 * Seller portal endpoints. The seller id always comes from the access token (rules.md §1.5),
 * never from the request.
 */
@Injectable()
export class SellerService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(SignInService) private readonly signIn: SignInService,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async profile(auth: AuthContext): Promise<SellerProfile> {
    const member = await this.db.sellerMember.findFirst({
      where: { sellerId: auth.sellerId, userId: auth.userId, seller: { deletedAt: null } },
      include: { seller: true },
    });
    if (!member) throw forbidden('This needs a seller account.');
    const s = member.seller;
    return {
      id: s.id,
      type: s.type,
      status: s.status,
      storeName: s.storeName,
      slug: s.slug,
      onboardingStep: s.onboardingStep,
      submittedAt: s.submittedAt?.toISOString() ?? null,
      approvedAt: s.approvedAt?.toISOString() ?? null,
      reviewNote: s.reviewNote,
      role: member.role,
    };
  }

  /**
   * Start a seller application: draft seller + owner membership (+ role "seller" for customers),
   * then rotate the session so the new tokens carry the seller context.
   */
  async startApplication(
    auth: AuthContext,
    body: StartSellerApplicationRequest,
    client: ClientContext,
  ): Promise<TokenPair> {
    if (auth.sellerId) throw alreadySeller();
    const user = await this.users.findActiveById(auth.userId);
    if (!user) throw unauthenticated();
    const session = await this.sessions.findActive(auth.sessionId);
    if (!session) throw sessionRevoked();
    const role = user.role === 'customer' ? 'seller' : user.role;
    const sellerId = uuidv7();
    await this.db.$transaction(async (tx) => {
      // One application at a time per user, even with parallel requests.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`seller-app:${user.id}`}))`;
      const existing = await tx.sellerMember.findFirst({
        where: { userId: user.id, seller: { deletedAt: null } },
        select: { sellerId: true },
      });
      if (existing) throw alreadySeller();
      await tx.seller.create({
        data: {
          id: sellerId,
          ownerUserId: user.id,
          type: body.type,
          status: 'draft',
          storeName: body.storeName,
          members: { create: { userId: user.id, role: 'owner' } },
        },
      });
      if (role !== user.role) await tx.user.update({ where: { id: user.id }, data: { role } });
      await this.audit.record(
        {
          action: 'seller.application_started',
          actorId: user.id,
          actorRole: user.role,
          targetType: 'seller',
          targetId: sellerId,
          ip: client.ip,
          meta: { type: body.type, via: 'application' },
        },
        tx,
      );
    });
    const next = await this.sessions.replace(session, client);
    if (!next) throw sessionRevoked();
    return this.signIn.tokenPair(next.session, next.refreshToken, role);
  }

  /** The caller's own products, all statuses, newest change first. */
  async products(
    sellerId: string,
    query: { cursor?: string; limit?: number },
  ): Promise<Paged<SellerProductRow>> {
    const limit = Math.min(query.limit ?? SELLER_PRODUCTS_DEFAULT_LIMIT, SELLER_PRODUCTS_MAX_LIMIT);
    const offset = decodeCursor(query.cursor);
    const rows = await this.db.withSellerScope(sellerId, (tx) =>
      tx.product.findMany({
        where: { sellerId, deletedAt: null },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: offset,
        take: limit + 1,
        select: { id: true, slug: true, title: true, status: true, updatedAt: true },
      }),
    );
    const items = rows.slice(0, limit).map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      status: p.status,
      updatedAt: p.updatedAt.toISOString(),
    }));
    return { items, nextCursor: rows.length > limit ? encodeCursor(offset + limit) : null };
  }
}

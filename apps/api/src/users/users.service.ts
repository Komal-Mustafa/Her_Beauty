import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, User } from '@hb/db';
import type { Me, SellerMemberRole } from '@hb/types';
import { unauthenticated } from '../auth/auth-errors';
import { identifierWhere, type Identifier } from '../auth/identifiers';
import { PrismaService } from '../prisma/prisma.service';

export interface SellerContext {
  sellerId: string;
  sellerRole: SellerMemberRole;
}

/** First membership by created_at of a seller that is not deleted (docs/b2-auth.md §2). */
const firstMembership = {
  where: { seller: { deletedAt: null } },
  orderBy: { createdAt: 'asc' },
  take: 1,
  include: { seller: true },
} satisfies Prisma.User$sellerMembershipsArgs;

type UserWithMembership = Prisma.UserGetPayload<{
  include: { sellerMemberships: typeof firstMembership };
}>;

function toMe(user: UserWithMembership): Me {
  const m = user.sellerMemberships[0];
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    // A number given at sign-up next to an email shows as unverified until it is verified.
    phone: user.phone ?? user.pendingPhone,
    emailVerified: user.emailVerifiedAt !== null,
    phoneVerified: user.phoneVerifiedAt !== null,
    role: user.role,
    hasPassword: user.passwordHash !== null,
    twoFactorEnabled: user.twofaEnabledAt !== null,
    seller: m
      ? {
          sellerId: m.sellerId,
          role: m.role,
          type: m.seller.type,
          status: m.seller.status,
          storeName: m.seller.storeName,
          slug: m.seller.slug,
        }
      : null,
    createdAt: user.createdAt.toISOString(),
  };
}

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  /** Active (not soft-deleted) account for an email or phone. */
  findByIdentifier(id: Identifier): Promise<User | null> {
    return this.db.user.findFirst({ where: { ...identifierWhere(id), deletedAt: null } });
  }

  findActiveById(userId: string): Promise<User | null> {
    return this.db.user.findFirst({ where: { id: userId, deletedAt: null, status: 'active' } });
  }

  async me(userId: string): Promise<Me> {
    const user = await this.db.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { sellerMemberships: firstMembership },
    });
    if (!user) throw unauthenticated();
    return toMe(user);
  }

  async updateName(userId: string, fullName: string): Promise<Me> {
    await this.db.user.update({ where: { id: userId }, data: { fullName } });
    return this.me(userId);
  }

  async sellerContext(userId: string): Promise<SellerContext | null> {
    const m = await this.db.sellerMember.findFirst({
      where: { userId, seller: { deletedAt: null } },
      orderBy: { createdAt: 'asc' },
      select: { sellerId: true, role: true },
    });
    return m ? { sellerId: m.sellerId, sellerRole: m.role } : null;
  }
}

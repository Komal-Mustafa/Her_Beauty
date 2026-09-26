import { Inject, Injectable } from '@nestjs/common';
import { SellerStatus, type AdminOverview } from '@hb/types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  /** Headline counts for the admin home. Read-only. */
  async overview(): Promise<AdminOverview> {
    return this.db.withPlatformScope('admin', async (tx) => {
      const [bySellerStatus, liveProducts, users, orders] = await Promise.all([
        tx.seller.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } }),
        tx.product.count({ where: { status: 'live', deletedAt: null } }),
        tx.user.count({ where: { deletedAt: null } }),
        tx.order.count(),
      ]);
      const sellers = Object.fromEntries(SellerStatus.options.map((s) => [s, 0])) as Record<
        SellerStatus,
        number
      >;
      for (const row of bySellerStatus) sellers[row.status] = row._count._all;
      return { sellers, liveProducts, users, orders };
    });
  }
}

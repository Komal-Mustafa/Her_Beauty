import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient, type Prisma } from '@hb/db';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * RLS roles that may read every seller's rows (init migration §7). `public_read` is for the
 * storefront, whose queries still filter to live rows of approved sellers themselves.
 */
export type PlatformRole = 'admin' | 'support' | 'finance' | 'system' | 'public_read';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // "minimal": errors never echo query arguments (password hashes, codes) into the logs.
    super({ errorFormat: 'minimal' });
  }

  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Run `fn` in a transaction scoped to one seller for row-level security (docs/b2-auth.md §5,
   * security.md §5). `set_config(..., true)` is transaction-local, so the settings never leak
   * to another request on a pooled connection. RLS is the second lock: every query inside must
   * still filter by the seller id taken from the access token.
   */
  withSellerScope<T>(
    sellerId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    if (!UUID.test(sellerId)) throw new Error('withSellerScope: sellerId must be a UUID');
    return this.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.seller_id', ${sellerId}, true), set_config('app.role', 'seller', true)`;
      return fn(tx);
    });
  }

  /**
   * Staff / background reads across all sellers, and storefront reads (`public_read`): RLS
   * `app.role` is set for the transaction. Without it a non-owner connection sees no rows.
   */
  withPlatformScope<T>(
    role: PlatformRole,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.role', ${role}, true)`;
      return fn(tx);
    });
  }
}

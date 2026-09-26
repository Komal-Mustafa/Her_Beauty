import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';

export * from '@prisma/client';
export { uuidv7 } from './uuid';
export { PASSWORD_HASH_PARAMS } from './password-params';

/**
 * Create a PrismaClient. The caller owns its lifecycle (call `$disconnect()` on shutdown).
 * In staging/prod the connection string must use the non-owner `app_user` role so
 * row-level security applies (docs/05-database-schema.md §5).
 */
export function createPrismaClient(options?: Prisma.PrismaClientOptions): PrismaClient {
  return new PrismaClient(options);
}

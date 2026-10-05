import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@hb/db';
import {
  estimateDelivery,
  runSearch,
  selectProducts,
  toProductCard,
  type DeliveryEstimate,
  type Paged,
  type PkCity,
  type Product,
  type ProductCard,
  type ProductQuery,
  type SearchContext,
  type SearchQuery,
  type SearchResult,
} from '@hb/types';
import { notFound } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import {
  productInclude,
  sellerSelect,
  shippingProfileSelect,
  toBrand,
  toCategory,
  toProduct,
  toReview,
  toShippingProfile,
  toStore,
  type ProductRow,
} from './mappers';

const DEFAULT_LIMIT = 24;
/**
 * Search, facets and sort run in memory over at most this many live products (newest first)
 * until Meilisearch replaces them behind the same endpoints and types (docs/p5-catalog.md §3.3).
 */
const MAX_SCAN = 2000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only approved, non-deleted sellers are visible on the storefront. */
export const LIVE_SELLER = {
  status: 'approved',
  deletedAt: null,
} satisfies Prisma.SellerWhereInput;

/** Storefront-visible brands: a brand whose owning seller is hidden is hidden with it. */
export const VISIBLE_BRAND = {
  OR: [{ ownerSellerId: null }, { ownerSeller: LIVE_SELLER }],
} satisfies Prisma.BrandWhereInput;

/** Storefront-visible products: live, not deleted, and sold by a visible seller. */
export const LIVE = {
  status: 'live',
  deletedAt: null,
  seller: LIVE_SELLER,
} satisfies Prisma.ProductWhereInput;

type Db = Prisma.TransactionClient;

/** Opaque cursor so clients never depend on its shape. */
const encodeCursor = (offset: number) => Buffer.from(`o:${offset}`).toString('base64url');
function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  const raw = Buffer.from(cursor, 'base64url').toString();
  const n = raw.startsWith('o:') ? Number.parseInt(raw.slice(2), 10) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

@Injectable()
export class CatalogService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  /**
   * Reads that touch RLS tables (products, ad_campaigns) run with app.role = 'public_read', so
   * the storefront also works when the API connects as the non-owner role (docs/b2-auth.md §5).
   */
  private publicRead<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    return this.db.withPlatformScope('public_read', fn);
  }

  async categories() {
    const rows = await this.db.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toCategory);
  }

  async category(slug: string) {
    const row = await this.db.category.findFirst({ where: { slug, isActive: true } });
    if (!row) throw notFound('Category');
    return toCategory(row);
  }

  async brands() {
    const rows = await this.publicRead((tx) =>
      tx.brand.findMany({ where: VISIBLE_BRAND, orderBy: { name: 'asc' } }),
    );
    return rows.map(toBrand);
  }

  async brand(slug: string) {
    const row = await this.publicRead((tx) =>
      tx.brand.findFirst({ where: { slug, ...VISIBLE_BRAND } }),
    );
    if (!row) throw notFound('Brand');
    return toBrand(row);
  }

  /** Average product rating per seller (weighted by review count). */
  private async sellerRatings(tx: Db, sellerIds: string[]): Promise<Map<string, number>> {
    if (!sellerIds.length) return new Map();
    const rows = await tx.product.findMany({
      where: { ...LIVE, sellerId: { in: sellerIds } },
      select: { sellerId: true, ratingAvg: true, ratingCount: true },
    });
    const acc = new Map<string, { sum: number; n: number }>();
    for (const r of rows) {
      const a = acc.get(r.sellerId) ?? { sum: 0, n: 0 };
      a.sum += Number(r.ratingAvg) * r.ratingCount;
      a.n += r.ratingCount;
      acc.set(r.sellerId, a);
    }
    return new Map(
      [...acc].map(([id, { sum, n }]) => [id, n ? Math.round((sum / n) * 10) / 10 : 0]),
    );
  }

  /** Product ids promoted by live sponsored-product campaigns (always labelled "Sponsored"). */
  private async sponsoredIds(tx: Db): Promise<Set<string>> {
    const campaigns = await tx.adCampaign.findMany({
      where: { status: 'live' },
      select: { productIds: true },
    });
    return new Set(campaigns.flatMap((c) => c.productIds));
  }

  private async hydrate(tx: Db, rows: ProductRow[]): Promise<Product[]> {
    const [ratings, sponsored] = await Promise.all([
      this.sellerRatings(tx, [...new Set(rows.map((r) => r.sellerId))]),
      this.sponsoredIds(tx),
    ]);
    return rows.map((r) => toProduct(r, ratings.get(r.sellerId) ?? 0, sponsored.has(r.id)));
  }

  /**
   * Live products of visible sellers, newest first: the input order the shared sort keeps for
   * ties (docs/p5-catalog.md §4). `narrow` only saves loading rows the filters drop anyway.
   */
  private async liveProducts(tx: Db, narrow: Prisma.ProductWhereInput = {}): Promise<Product[]> {
    const rows = await tx.product.findMany({
      where: { AND: [LIVE, narrow] },
      include: productInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MAX_SCAN,
    });
    return this.hydrate(tx, rows);
  }

  /** Active categories in menu order: slugs for filters and facets, names for text search. */
  private async searchContext(): Promise<SearchContext> {
    const categories = await this.db.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, slug: true, name: true },
    });
    return { categories };
  }

  /** GET /products: the shared filter and order (`selectProducts`), then an opaque cursor. */
  async products(q: ProductQuery): Promise<Paged<ProductCard>> {
    const [ctx, list] = await Promise.all([
      this.searchContext(),
      this.publicRead((tx) => this.liveProducts(tx, narrowProducts(q))),
    ]);
    const ordered = selectProducts(list, q, ctx);
    const limit = q.limit ?? DEFAULT_LIMIT;
    const start = decodeCursor(q.cursor);
    return {
      items: ordered.slice(start, start + limit).map(toProductCard),
      nextCursor: start + limit < ordered.length ? encodeCursor(start + limit) : null,
    };
  }

  /**
   * GET /search: the shared `runSearch` over every live product (facets count products outside
   * the current filters, so nothing is narrowed in SQL). Search params never reach SQL.
   */
  async search(q: SearchQuery): Promise<SearchResult> {
    const [ctx, list] = await Promise.all([
      this.searchContext(),
      this.publicRead((tx) => this.liveProducts(tx)),
    ]);
    return runSearch(list, q, ctx);
  }

  /**
   * GET /products/:slug/delivery: the seller's shipping settings and lightest rate for the zone
   * between its city and the shopper's (shared `estimateDelivery`). A product that is not on
   * sale (hidden, draft, or of a hidden seller) is 404.
   */
  async deliveryEstimate(slug: string, city: PkCity): Promise<DeliveryEstimate> {
    const row = await this.publicRead((tx) =>
      tx.product.findFirst({
        where: { ...LIVE, slug },
        select: { seller: { select: shippingProfileSelect } },
      }),
    );
    if (!row) throw notFound('Product');
    return estimateDelivery(row.seller.city ?? '', city, toShippingProfile(row.seller));
  }

  async product(slug: string): Promise<Product> {
    const [product] = await this.publicRead(async (tx) => {
      const row = await tx.product.findFirst({
        where: { ...LIVE, slug },
        include: productInclude,
      });
      return row ? this.hydrate(tx, [row]) : [];
    });
    if (!product) throw notFound('Product');
    return product;
  }

  async reviews(productSlug: string) {
    const product = await this.publicRead((tx) =>
      tx.product.findFirst({
        where: { ...LIVE, slug: productSlug },
        select: { id: true },
      }),
    );
    if (!product) throw notFound('Product');
    return this.reviewsByProductId(product.id);
  }

  async reviewsByProductId(productId: string) {
    if (!UUID.test(productId)) return [];
    const rows = await this.db.review.findMany({
      where: { productId, status: 'published' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
      include: { customer: { select: { fullName: true } } },
    });
    return rows.map(toReview);
  }

  private storesWhere(where: Prisma.SellerWhereInput) {
    return this.publicRead(async (tx) => {
      const sellers = await tx.seller.findMany({
        where: { ...where, ...LIVE_SELLER },
        select: sellerSelect,
        orderBy: { storeName: 'asc' },
      });
      const ids = sellers.map((s) => s.id);
      const [ratings, counts] = await Promise.all([
        this.sellerRatings(tx, ids),
        tx.product.groupBy({
          by: ['sellerId'],
          where: { ...LIVE, sellerId: { in: ids } },
          _count: { _all: true },
        }),
      ]);
      const countBy = new Map(counts.map((c) => [c.sellerId, c._count._all]));
      return sellers.map((s) => toStore(s, ratings.get(s.id) ?? 0, countBy.get(s.id) ?? 0));
    });
  }

  stores() {
    return this.storesWhere({});
  }

  async store(slug: string) {
    const [store] = await this.storesWhere({ slug });
    if (!store) throw notFound('Store');
    return store;
  }
}

/**
 * SQL conditions equal to (or looser than) the shared filters of a GET /products query, so only
 * rows that can match are loaded. The shared filter still runs on the result and decides; text,
 * price, shade, sale and new filters are left to it.
 */
function narrowProducts(q: ProductQuery): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {};
  if (q.category) where.category = { slug: q.category };
  if (q.brand?.length) where.brand = { slug: { in: q.brand } };
  if (q.seller || q.sellerType) {
    where.seller = {
      ...(q.seller ? { slug: q.seller } : {}),
      ...(q.sellerType ? { type: q.sellerType } : {}),
    };
  }
  if (q.skinType?.length) where.skinTypes = { hasSome: q.skinType };
  if (q.minRating !== undefined) where.ratingAvg = { gte: q.minRating };
  // Product ids are UUIDs; anything else cannot match (and must not reach a uuid column).
  if (q.ids?.length) where.id = { in: q.ids.filter((id) => UUID.test(id)) };
  return where;
}

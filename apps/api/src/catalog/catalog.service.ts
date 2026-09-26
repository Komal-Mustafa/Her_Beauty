import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@hb/db';
import type { Paged, Product, ProductCard, ProductQuery } from '@hb/types';
import { notFound } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import {
  productInclude,
  sellerSelect,
  toBrand,
  toCard,
  toCategory,
  toProduct,
  toReview,
  toStore,
  type ProductRow,
} from './mappers';

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;
/** Guard until search moves to Meilisearch (02-trd §4 search module). */
const MAX_SCAN = 2000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LIVE = { status: 'live', deletedAt: null } satisfies Prisma.ProductWhereInput;

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
    const rows = await this.db.brand.findMany({ orderBy: { name: 'asc' } });
    return rows.map(toBrand);
  }

  async brand(slug: string) {
    const row = await this.db.brand.findUnique({ where: { slug } });
    if (!row) throw notFound('Brand');
    return toBrand(row);
  }

  /** Average product rating per seller (weighted by review count). */
  private async sellerRatings(sellerIds: string[]): Promise<Map<string, number>> {
    if (!sellerIds.length) return new Map();
    const rows = await this.db.product.findMany({
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
  private async sponsoredIds(): Promise<Set<string>> {
    const campaigns = await this.db.adCampaign.findMany({
      where: { status: 'live' },
      select: { productIds: true },
    });
    return new Set(campaigns.flatMap((c) => c.productIds));
  }

  private async hydrate(rows: ProductRow[]): Promise<Product[]> {
    const [ratings, sponsored] = await Promise.all([
      this.sellerRatings([...new Set(rows.map((r) => r.sellerId))]),
      this.sponsoredIds(),
    ]);
    return rows.map((r) => toProduct(r, ratings.get(r.sellerId) ?? 0, sponsored.has(r.id)));
  }

  async products(q: ProductQuery): Promise<Paged<ProductCard>> {
    const where: Prisma.ProductWhereInput = { ...LIVE };
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
    if (q.q) {
      where.OR = [
        { title: { contains: q.q, mode: 'insensitive' } },
        { brand: { name: { contains: q.q, mode: 'insensitive' } } },
        { seller: { storeName: { contains: q.q, mode: 'insensitive' } } },
      ];
    }

    const rows = await this.db.product.findMany({
      where,
      include: productInclude,
      orderBy: { createdAt: 'desc' },
      take: MAX_SCAN,
    });
    let list = await this.hydrate(rows);
    // Price lives on variants (cheapest active variant), so range + price sort run after load.
    if (q.minPrice !== undefined) list = list.filter((p) => p.price >= (q.minPrice ?? 0));
    if (q.maxPrice !== undefined) list = list.filter((p) => p.price <= (q.maxPrice ?? 0));
    list = sortProducts(list, q.sort);

    const limit = Math.min(q.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const start = decodeCursor(q.cursor);
    const page = list.slice(start, start + limit).map(toCard);
    return {
      items: page,
      nextCursor: start + limit < list.length ? encodeCursor(start + limit) : null,
    };
  }

  async product(slug: string): Promise<Product> {
    const row = await this.db.product.findFirst({
      where: { ...LIVE, slug },
      include: productInclude,
    });
    if (!row) throw notFound('Product');
    const [product] = await this.hydrate([row]);
    if (!product) throw notFound('Product');
    return product;
  }

  async reviews(productSlug: string) {
    const product = await this.db.product.findFirst({
      where: { ...LIVE, slug: productSlug },
      select: { id: true },
    });
    if (!product) throw notFound('Product');
    return this.reviewsByProductId(product.id);
  }

  async reviewsByProductId(productId: string) {
    if (!UUID.test(productId)) return [];
    const product = { id: productId };
    const rows = await this.db.review.findMany({
      where: { productId: product.id, status: 'published' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { customer: { select: { fullName: true } } },
    });
    return rows.map(toReview);
  }

  private async storesWhere(where: Prisma.SellerWhereInput) {
    const sellers = await this.db.seller.findMany({
      where: { ...where, status: 'approved', deletedAt: null },
      select: sellerSelect,
      orderBy: { storeName: 'asc' },
    });
    const ids = sellers.map((s) => s.id);
    const [ratings, counts] = await Promise.all([
      this.sellerRatings(ids),
      this.db.product.groupBy({
        by: ['sellerId'],
        where: { ...LIVE, sellerId: { in: ids } },
        _count: { _all: true },
      }),
    ]);
    const countBy = new Map(counts.map((c) => [c.sellerId, c._count._all]));
    return sellers.map((s) => toStore(s, ratings.get(s.id) ?? 0, countBy.get(s.id) ?? 0));
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

export function sortProducts(list: Product[], sort: ProductQuery['sort']): Product[] {
  const copy = [...list];
  switch (sort) {
    case 'newest':
      return copy; // already newest first
    case 'price_asc':
      return copy.sort((a, b) => a.price - b.price);
    case 'price_desc':
      return copy.sort((a, b) => b.price - a.price);
    case 'rating':
      return copy.sort((a, b) => b.rating - a.rating || b.ratingCount - a.ratingCount);
    case 'best_selling':
      return copy.sort((a, b) => b.soldCount - a.soldCount);
    default:
      // relevance: sponsored first (clearly labelled), then best sellers
      return copy.sort(
        (a, b) => Number(b.sponsored) - Number(a.sponsored) || b.soldCount - a.soldCount,
      );
  }
}

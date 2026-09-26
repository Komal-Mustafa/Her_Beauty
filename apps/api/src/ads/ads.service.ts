import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@hb/db';
import type { AdPackage, AdSlotCode, HeroScene, ServedAd } from '@hb/types';
import { mediaUrl, money, proceduralKind } from '../common/media';
import { PrismaService } from '../prisma/prisma.service';

const campaignInclude = {
  seller: { select: { storeName: true } },
  creative: {
    include: {
      targetProduct: {
        select: {
          slug: true,
          title: true,
          media: {
            where: { type: 'image', status: 'ready' },
            orderBy: { sortOrder: 'asc' },
            take: 1,
            select: { fileKey: true },
          },
          variants: {
            where: { isActive: true, shadeHex: { not: null } },
            orderBy: { price: 'asc' },
            take: 1,
            select: { shadeHex: true },
          },
        },
      },
    },
  },
} satisfies Prisma.AdCampaignInclude;

type CampaignRow = Prisma.AdCampaignGetPayload<{ include: typeof campaignInclude }>;

const SLOT_DAYS_KEYS: AdSlotCode[] = [
  'hero',
  'left_3d',
  'right_video',
  'category_banner',
  'sponsored_product',
];

/** Start of "today" in UTC for date-column comparisons. */
function todayUtc(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function toServedAd(c: CampaignRow, slot: AdSlotCode): ServedAd | null {
  const creative = c.creative;
  if (!creative || creative.status !== 'approved') return null;
  const product = creative.targetProduct;
  const kind = proceduralKind(creative.fileKey);
  return {
    id: c.id,
    slot,
    sellerName: c.seller.storeName ?? '',
    headline: creative.headline ?? product?.title ?? c.name,
    ctaLabel: creative.ctaLabel ?? 'Shop now',
    href: product ? `/product/${product.slug}` : '/',
    productSlug: product?.slug ?? null,
    media: {
      kind: creative.mediaType,
      url: mediaUrl(creative.fileKey),
      posterUrl: product?.media[0] ? mediaUrl(product.media[0].fileKey) : null,
      model3dKind: kind,
      shadeHex: product?.variants[0]?.shadeHex ?? null,
    },
  };
}

@Injectable()
export class AdsService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async packages(): Promise<AdPackage[]> {
    const [rows, seats] = await Promise.all([
      this.db.adPackage.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
      this.db.adSubscription.groupBy({
        by: ['packageId'],
        where: { status: { in: ['active', 'past_due'] } },
        _count: { _all: true },
      }),
    ]);
    const taken = new Map(seats.map((s) => [s.packageId, s._count._all]));
    return rows.map((p) => {
      const days = (p.slotDays ?? {}) as Record<string, unknown>;
      const features = (p.features ?? {}) as Record<string, unknown>;
      const featuredBrand = features.featuredBrand;
      return {
        id: p.id,
        code: p.code as AdPackage['code'],
        name: p.name,
        priceMonthly: money(p.priceMonthly),
        seatsTotal: p.seatsTotal,
        seatsTaken: taken.get(p.id) ?? 0,
        sponsoredProductsLimit: p.sponsoredProductsLimit,
        impressionsQuota: p.impressionsQuota,
        slotDays: Object.fromEntries(
          SLOT_DAYS_KEYS.map((k) => [k, typeof days[k] === 'number' ? days[k] : 0]),
        ) as AdPackage['slotDays'],
        featuredBrand: featuredBrand === 'yes' || featuredBrand === 'top' ? featuredBrand : 'none',
        popular: features.popular === true,
      };
    });
  }

  /**
   * GET /ads/serve — campaigns booked in this slot today (and for the category, for banners).
   * Only live campaigns with an approved creative are served.
   */
  async serve(slot: AdSlotCode, categorySlug?: string): Promise<ServedAd[]> {
    const bookings = await this.db.adSlotBooking.findMany({
      where: {
        day: todayUtc(),
        slot: {
          code: slot,
          ...(slot === 'category_banner' && categorySlug
            ? { category: { slug: categorySlug } }
            : {}),
        },
        campaign: { status: 'live' },
      },
      orderBy: { position: 'asc' },
      include: { campaign: { include: campaignInclude } },
    });
    return bookings
      .map((b) => toServedAd(b.campaign, slot))
      .filter((a): a is ServedAd => a !== null);
  }

  async heroScenes(): Promise<HeroScene[]> {
    const now = new Date();
    const rows = await this.db.cmsHeroScene.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        ],
      },
      orderBy: { sortOrder: 'asc' },
      include: { campaign: { include: campaignInclude } },
    });
    return rows.map((s) => ({
      id: s.id,
      sortOrder: s.sortOrder,
      title: s.title ?? '',
      subtitle: s.subtitle,
      poster: {
        url: mediaUrl(s.mediaKey),
        alt: s.title ?? 'Her Beauty',
        width: 1600,
        height: 900,
      },
      ad: s.campaign && s.campaign.status === 'live' ? toServedAd(s.campaign, 'hero') : null,
      startsAt: s.startsAt?.toISOString() ?? null,
      endsAt: s.endsAt?.toISOString() ?? null,
    }));
  }

  async plans() {
    const rows = await this.db.sellingPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map((p) => ({
      id: p.id,
      code: p.code as 'standard' | 'business' | 'enterprise',
      name: p.name,
      priceMonthly: money(p.priceMonthly),
      productLimit: p.productLimit,
      imagesPerProduct: p.imagesPerProduct,
      video: p.allowVideo,
      model3d: p.allow3d,
      staffLogins: p.staffLimit,
      commissionBps: p.commissionBps,
      adDiscountBps: p.adDiscountBps,
    }));
  }
}

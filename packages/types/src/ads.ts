import { z } from 'zod';
import { Asset, Id, IsoDateTime, Money, Slug } from './common';

// Mirrors ad_packages / ad_slots / cms_hero_scenes in docs/05-database-schema.md and PRD §7.6.

export const AdSlotCode = z.enum([
  'hero',
  'left_3d',
  'right_video',
  'category_banner',
  'sponsored_product',
]);
export type AdSlotCode = z.infer<typeof AdSlotCode>;

export const BillingCycle = z.enum(['monthly', 'quarterly', 'yearly']);
export type BillingCycle = z.infer<typeof BillingCycle>;

export const AdPackageCode = z.enum(['glow', 'radiance', 'luxe', 'icon']);
export type AdPackageCode = z.infer<typeof AdPackageCode>;

export const AdPackage = z.object({
  id: Id,
  code: AdPackageCode,
  name: z.string(),
  priceMonthly: Money,
  seatsTotal: z.number().int().positive().nullable(), // null = unlimited
  seatsTaken: z.number().int().nonnegative(),
  sponsoredProductsLimit: z.number().int().positive().nullable(),
  impressionsQuota: z.number().int().positive(),
  slotDays: z.record(AdSlotCode, z.number().int().nonnegative()),
  featuredBrand: z.enum(['none', 'yes', 'top']),
  popular: z.boolean(),
});
export type AdPackage = z.infer<typeof AdPackage>;

/** What the storefront receives from GET /ads/serve?slot=… — always rendered with "Sponsored". */
export const ServedAd = z.object({
  id: Id,
  slot: AdSlotCode,
  sellerName: z.string(),
  headline: z.string(),
  ctaLabel: z.string(),
  href: z.string(),
  productSlug: Slug.nullable(),
  media: z.object({
    kind: z.enum(['image', 'video', 'model3d']),
    url: z.string(),
    posterUrl: z.string().nullable(),
    model3dKind: z.enum(['lipstick', 'compact', 'perfume', 'jar']).nullable(),
    shadeHex: z.string().nullable(),
  }),
});
export type ServedAd = z.infer<typeof ServedAd>;

export const HeroScene = z.object({
  id: Id,
  sortOrder: z.number().int(),
  title: z.string(),
  subtitle: z.string().nullable(),
  poster: Asset,
  /** Present when the scene is a paid "hero" ad (Icon package). */
  ad: ServedAd.nullable(),
  startsAt: IsoDateTime.nullable(),
  endsAt: IsoDateTime.nullable(),
});
export type HeroScene = z.infer<typeof HeroScene>;

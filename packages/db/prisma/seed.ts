/**
 * Development / CI seed (docs/05-database-schema.md §8).
 *
 * Loads the same catalogue the storefront uses in mock mode (@hb/sdk/fixtures), so
 * NEXT_PUBLIC_API_MODE=http shows the same shop as mock mode. Also seeds plans, ad packages,
 * ad slots, settings and platform ledger accounts from the doc.
 *
 * Safe to run twice: it does nothing when the catalogue already exists. To start over, run
 * `pnpm --filter @hb/db exec prisma migrate reset` on your local database.
 *
 * Seeded orders exist only so reviews can be "verified purchases" (rules.md §5). They are demo
 * history: no payments or ledger postings are created for them. Never run this in production.
 *
 * Demo sign-in (docs/b2-auth.md §8): with SEED_DEMO_PASSWORD set, the store owners
 * (owner@<slug>.test), the two customers (ayesha@hb.test, sana@hb.test) and the super admin
 * (SEED_ADMIN_EMAIL) get that password; unset, they have none (code sign-in only). There is no
 * default password in code. Re-running with SEED_DEMO_PASSWORD on an already seeded database
 * (re)applies it to those accounts. The super admin has no 2FA, so the first admin sign-in walks
 * through enrolment.
 */
import {
  adPackages,
  brands,
  categories,
  heroScenes,
  products,
  reviews,
  sellingPlans,
  servedAds,
  shippingProfiles,
  sponsoredProductSlugs,
  stores,
} from '@hb/sdk/fixtures';
import type { AdSlotCode } from '@hb/types';
import { hash, type Algorithm } from '@node-rs/argon2';
import { PrismaClient, type Prisma } from '@prisma/client';
import { PASSWORD_HASH_PARAMS } from '../src/password-params';
import { uuidv7 } from '../src/uuid';

const DAY = 86_400_000;
const BOOKING_DAYS_BEFORE = 1;
const BOOKING_DAYS_AFTER = 90;

const log = (msg: string) => process.stdout.write(`[seed] ${msg}\n`);

/** Demo customers: review author ⇒ account (docs/b2-auth.md §8). */
const DEMO_CUSTOMERS: Record<string, { fullName: string; email: string }> = {
  'Ayesha K.': { fullName: 'Ayesha Khan', email: 'ayesha@hb.test' },
  'Sana R.': { fullName: 'Sana Riaz', email: 'sana@hb.test' },
  'Mehwish A.': { fullName: 'Mehwish Ali', email: 'mehwish@hb.test' },
  'Hira S.': { fullName: 'Hira Shah', email: 'hira@hb.test' },
  'Fatima Z.': { fullName: 'Fatima Zaidi', email: 'fatima@hb.test' },
};

/** "Mehwish A." → "mehwish.a": letters and digits joined by single dots (a valid local part). */
function emailLocalPart(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

/** Argon2id hash of SEED_DEMO_PASSWORD (same parameters as the API), or null when unset. */
async function demoPasswordHash(): Promise<string | null> {
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password) return null;
  if (password.length < 8) {
    throw new Error('seed: SEED_DEMO_PASSWORD must be at least 8 characters');
  }
  return hash(password, {
    ...PASSWORD_HASH_PARAMS,
    algorithm: PASSWORD_HASH_PARAMS.algorithm as Algorithm,
  });
}

/**
 * Set once in main(): hash of SEED_DEMO_PASSWORD, or null (demo accounts get no password).
 * Seeded addresses count as verified — they are demo data — so password sign-in works.
 */
let passwordHash: string | null = null;

/** Stable fixture id → UUIDv7 map for this run. */
const ids = new Map<string, string>();
function idFor(fixtureId: string): string {
  let id = ids.get(fixtureId);
  if (!id) {
    id = uuidv7();
    ids.set(fixtureId, id);
  }
  return id;
}

function utcDay(offsetDays: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays));
}

const commission = (subtotal: bigint, bps: number) => (subtotal * BigInt(bps)) / 10_000n;

async function seedReferenceData(db: Prisma.TransactionClient) {
  await db.sellingPlan.createMany({
    data: sellingPlans.map((p, i) => ({
      id: idFor(p.id),
      code: p.code,
      name: p.name,
      priceMonthly: BigInt(p.priceMonthly),
      productLimit: p.productLimit,
      imagesPerProduct: p.imagesPerProduct,
      allowVideo: p.video,
      allow3d: p.model3d,
      staffLimit: p.staffLogins,
      commissionBps: p.commissionBps,
      adDiscountBps: p.adDiscountBps,
      sortOrder: i,
    })),
  });

  await db.adPackage.createMany({
    data: adPackages.map((p, i) => ({
      id: idFor(p.id),
      code: p.code,
      name: p.name,
      priceMonthly: BigInt(p.priceMonthly),
      seatsTotal: p.seatsTotal,
      sponsoredProductsLimit: p.sponsoredProductsLimit,
      impressionsQuota: p.impressionsQuota,
      slotDays: p.slotDays,
      features: { featuredBrand: p.featuredBrand, popular: p.popular },
      sortOrder: i,
    })),
  });

  await db.setting.createMany({
    data: [
      { key: 'return_window_days', value: 7 },
      { key: 'auto_confirm_days', value: 14 },
      { key: 'payout_min', value: 100_000 },
      { key: 'four_eyes_limit', value: 20_000_000 },
      { key: 'new_seller_hold_days', value: 14 },
    ],
  });

  const platformAccounts = [
    'escrow',
    'revenue_commission',
    'revenue_plans',
    'revenue_ads',
    'gateway_clearing',
    'bank_clearing',
    'payout_pending',
    'cod_receivable',
    'fees',
  ] as const;
  await db.ledgerAccount.createMany({
    data: platformAccounts.map((type) => ({
      id: uuidv7(),
      ownerType: 'platform',
      ownerId: null,
      type,
    })),
  });

  await ensureSuperAdmin(db);
}

/**
 * Super admin from SEED_ADMIN_EMAIL. Without SEED_DEMO_PASSWORD it has no password (set one
 * through "forgot password"); 2FA is never pre-enabled, so the first admin sign-in enrols.
 */
async function ensureSuperAdmin(db: Prisma.TransactionClient) {
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) return;
  if (await db.user.findUnique({ where: { email: adminEmail } })) return;
  await db.user.create({
    data: {
      id: uuidv7(),
      email: adminEmail,
      fullName: 'Super Admin',
      role: 'super_admin',
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });
  log(`super admin created for ${adminEmail}`);
}

async function seedCatalogue(db: Prisma.TransactionClient) {
  await db.category.createMany({
    data: categories.map((c, i) => ({
      id: idFor(c.id),
      parentId: c.parentId ? idFor(c.parentId) : null,
      name: c.name,
      slug: c.slug,
      iconKey: c.image.url,
      sortOrder: i,
    })),
  });

  const planByType = {
    manufacturer: idFor(sellingPlans.find((p) => p.code === 'enterprise')?.id ?? ''),
    vendor: idFor(sellingPlans.find((p) => p.code === 'business')?.id ?? ''),
  };

  for (const s of stores) {
    const ownerId = uuidv7();
    const sellerId = idFor(s.id);
    const approvedAt = new Date(s.joinedAt);
    await db.user.create({
      data: {
        id: ownerId,
        email: `owner@${s.slug}.test`,
        fullName: `${s.storeName} Owner`,
        role: 'seller',
        passwordHash,
        emailVerifiedAt: approvedAt,
      },
    });
    await db.seller.create({
      data: {
        id: sellerId,
        ownerUserId: ownerId,
        type: s.type,
        status: 'approved',
        legalName: `${s.storeName} (Pvt) Ltd`,
        storeName: s.storeName,
        slug: s.slug,
        city: s.city,
        logoKey: s.logo.url,
        bannerKey: s.banner.url,
        about: s.about,
        onboardingStep: 9,
        submittedAt: new Date(approvedAt.getTime() - 2 * DAY),
        approvedAt,
        createdAt: new Date(approvedAt.getTime() - 3 * DAY),
        members: { create: { userId: ownerId, role: 'owner' } },
        subscriptions: {
          create: {
            id: uuidv7(),
            planId: planByType[s.type],
            status: 'active',
            currentPeriodStart: utcDay(-10),
            currentPeriodEnd: utcDay(20),
          },
        },
      },
    });
    await db.ledgerAccount.createMany({
      data: (['wallet_held', 'wallet_available'] as const).map((type) => ({
        id: uuidv7(),
        ownerType: 'seller' as const,
        ownerId: sellerId,
        type,
      })),
    });
  }

  await db.brand.createMany({
    data: brands.map((b) => ({
      id: idFor(b.id),
      name: b.name,
      slug: b.slug,
      logoKey: b.logo.url,
      ownerSellerId: b.ownerSellerId ? idFor(b.ownerSellerId) : null,
      isProtected: b.isProtected,
      verifiedAt: b.isProtected ? new Date('2026-06-01T00:00:00.000Z') : null,
    })),
  });

  for (const [index, p] of products.entries()) {
    // The API calls a product new for 30 days and lists newest first: new products are 1–13 days
    // old, the rest 60+ days, each in fixture order — the order mock mode sorts ties in.
    const createdAt = new Date(Date.now() - (p.isNew ? 1 + index / 4 : 60 + index) * DAY);
    await db.product.create({
      data: {
        id: idFor(p.id),
        sellerId: idFor(p.seller.id),
        brandId: idFor(p.brand.id),
        categoryId: idFor(p.categoryId),
        title: p.title,
        slug: p.slug,
        descriptionHtml: p.descriptionHtml,
        howToUse: p.howToUse,
        ingredients: p.ingredients,
        skinTypes: p.skinTypes,
        tags: p.tags,
        status: 'live',
        has3d: p.has3d,
        hasVideo: p.hasVideo,
        ratingAvg: p.rating,
        ratingCount: p.ratingCount,
        soldCount: p.soldCount,
        createdAt,
        variants: {
          create: p.variants.map((v) => ({
            id: idFor(v.id),
            sku: v.sku,
            shadeName: v.shadeName,
            shadeHex: v.shadeHex,
            sizeLabel: v.sizeLabel,
            price: BigInt(v.price),
            compareAtPrice: v.compareAtPrice === null ? null : BigInt(v.compareAtPrice),
            currency: v.currency,
            stock: v.stock,
          })),
        },
        media: {
          create: p.media.map((m, i) => ({
            id: uuidv7(),
            type: m.type,
            fileKey: m.type === 'model3d' ? `procedural:${m.model3dKind ?? 'jar'}` : m.url,
            posterKey: m.posterUrl,
            status: 'ready' as const,
            sortOrder: i,
            altText: m.alt,
            ...(m.type === 'image' ? { width: 800, height: 1000 } : {}),
          })),
        },
      },
    });
  }
  log(
    `${categories.length} categories, ${stores.length} stores, ${brands.length} brands, ${products.length} products`,
  );
}

/** Reviews must reference a bought order item, so each reviewer gets one completed order. */
async function seedReviews(db: Prisma.TransactionClient) {
  const byAuthor = new Map<string, typeof reviews>();
  for (const r of reviews) byAuthor.set(r.authorName, [...(byAuthor.get(r.authorName) ?? []), r]);
  const productById = new Map(products.map((p) => [p.id, p]));
  const plans = new Map(sellingPlans.map((p) => [p.code, p.commissionBps]));
  let orderNo = 1;

  for (const [author, list] of byAuthor) {
    const customerId = uuidv7();
    const demo = DEMO_CUSTOMERS[author];
    const fullName = demo?.fullName ?? author;
    await db.user.create({
      data: {
        id: customerId,
        email: demo?.email ?? `${emailLocalPart(fullName)}@customer.test`,
        phone: `+9230000000${String(orderNo).padStart(2, '0')}`,
        fullName,
        passwordHash,
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: new Date(),
      },
    });

    const placedAt = new Date(Math.min(...list.map((r) => Date.parse(r.createdAt))) - 10 * DAY);
    const lines = list.map((r) => {
      const product = productById.get(r.productId);
      const variant = product?.variants[0];
      if (!product || !variant) throw new Error(`seed: review ${r.id} has no product`);
      return { review: r, product, variant, price: BigInt(variant.price) };
    });
    const bySeller = new Map<string, typeof lines>();
    for (const l of lines)
      bySeller.set(l.product.seller.id, [...(bySeller.get(l.product.seller.id) ?? []), l]);

    const subtotal = lines.reduce((sum, l) => sum + l.price, 0n);
    const shippingPerSeller = 25_000n; // Rs 250
    const shippingTotal = shippingPerSeller * BigInt(bySeller.size);
    const orderId = uuidv7();
    await db.order.create({
      data: {
        id: orderId,
        number: `HB-SEED-${String(orderNo).padStart(6, '0')}`,
        customerId,
        status: 'completed',
        paymentMethod: 'card',
        subtotal,
        shippingTotal,
        grandTotal: subtotal + shippingTotal,
        addressSnapshot: { fullName, city: 'Lahore', line1: 'Seed Street 1', country: 'PK' },
        contactPhone: `+9230000000${String(orderNo).padStart(2, '0')}`,
        idempotencyKey: `seed-order-${orderNo}`,
        createdAt: placedAt,
      },
    });

    for (const [fixtureSellerId, sellerLines] of bySeller) {
      const store = stores.find((s) => s.id === fixtureSellerId);
      const bps = plans.get(store?.type === 'manufacturer' ? 'enterprise' : 'business') ?? 1500;
      const soSubtotal = sellerLines.reduce((sum, l) => sum + l.price, 0n);
      const commissionAmount = commission(soSubtotal, bps);
      const deliveredAt = new Date(placedAt.getTime() + 3 * DAY);
      await db.sellerOrder.create({
        data: {
          id: uuidv7(),
          orderId,
          sellerId: idFor(fixtureSellerId),
          status: 'released',
          subtotal: soSubtotal,
          shippingFee: shippingPerSeller,
          commissionBps: bps,
          commissionAmount,
          sellerNet: soSubtotal + shippingPerSeller - commissionAmount,
          acceptedAt: new Date(placedAt.getTime() + DAY / 4),
          shippedAt: new Date(placedAt.getTime() + DAY),
          deliveredAt,
          deliveryProof: 'courier',
          releaseAt: new Date(deliveredAt.getTime() + 7 * DAY),
          releasedAt: new Date(deliveredAt.getTime() + 7 * DAY),
          createdAt: placedAt,
          items: {
            create: sellerLines.map((l) => ({
              id: uuidv7(),
              variantId: idFor(l.variant.id),
              productId: idFor(l.product.id),
              titleSnapshot: l.product.title,
              shadeSnapshot: l.variant.shadeName,
              unitPrice: l.price,
              qty: 1,
              lineTotal: l.price,
              review: {
                create: {
                  id: idFor(l.review.id),
                  productId: idFor(l.product.id),
                  customerId,
                  rating: l.review.rating,
                  title: l.review.title,
                  body: l.review.body,
                  photoKeys: l.review.photos.map((photo) => photo.url),
                  createdAt: new Date(l.review.createdAt),
                },
              },
            })),
          },
        },
      });
    }
    orderNo += 1;
  }
  log(`${reviews.length} verified reviews from ${byAuthor.size} customers`);
}

/** Each seller's shipping_settings and rate card (the mock adapter reads the same fixture). */
async function seedShipping(db: Prisma.TransactionClient) {
  let rates = 0;
  for (const s of stores) {
    const profile = shippingProfiles[s.id];
    if (!profile) continue;
    const sellerId = idFor(s.id);
    await db.shippingSetting.create({
      data: {
        sellerId,
        mode: 'manual',
        handlingDays: profile.handlingDays,
        freeShippingMin: profile.freeShippingMin === null ? null : BigInt(profile.freeShippingMin),
        codEnabled: profile.codEnabled,
      },
    });
    await db.shippingRate.createMany({
      data: profile.rates.map((r) => ({
        id: uuidv7(),
        sellerId,
        zone: r.zone,
        minWeightG: r.minWeightG,
        maxWeightG: r.maxWeightG,
        price: BigInt(r.price),
        estDaysMin: r.daysMin,
        estDaysMax: r.daysMax,
      })),
    });
    rates += profile.rates.length;
  }
  log(`shipping settings for ${stores.length} sellers, ${rates} rates`);
}

/** Ad slots, one subscription + creative + live campaign per served ad, and daily bookings. */
async function seedAds(db: Prisma.TransactionClient) {
  const slotCodes: AdSlotCode[] = ['hero', 'left_3d', 'right_video', 'sponsored_product'];
  const perSlotCount = (code: AdSlotCode) => servedAds.filter((a) => a.slot === code).length;
  const slotIds = new Map<string, string>();
  for (const code of slotCodes) {
    const id = uuidv7();
    slotIds.set(code, id);
    await db.adSlot.create({ data: { id, code, positions: Math.max(1, perSlotCount(code)) } });
  }
  for (const c of categories) {
    const id = uuidv7();
    slotIds.set(`category_banner:${c.slug}`, id);
    await db.adSlot.create({
      data: { id, code: 'category_banner', categoryId: idFor(c.id), positions: 1 },
    });
  }

  // Which package each advertiser holds (one active ad subscription per seller).
  const packageFor: Record<string, string> = {
    hero: 'icon',
    left_3d: 'luxe',
    right_video: 'radiance',
    category_banner: 'radiance',
  };
  const subscriptionBySeller = new Map<string, string>();
  const positionInSlot = new Map<string, number>();
  const productBySlug = new Map(products.map((p) => [p.slug, p]));

  for (const ad of servedAds) {
    const store = stores.find((s) => s.storeName === ad.sellerName);
    const product = ad.productSlug ? productBySlug.get(ad.productSlug) : undefined;
    if (!store || !product) throw new Error(`seed: served ad ${ad.id} has no store/product`);
    const sellerId = idFor(store.id);

    let subscriptionId = subscriptionBySeller.get(sellerId);
    if (!subscriptionId) {
      subscriptionId = uuidv7();
      const pkg = adPackages.find((p) => p.code === packageFor[ad.slot]);
      await db.adSubscription.create({
        data: {
          id: subscriptionId,
          sellerId,
          packageId: idFor(pkg?.id ?? ''),
          status: 'active',
          currentPeriodStart: utcDay(-BOOKING_DAYS_BEFORE),
          currentPeriodEnd: utcDay(BOOKING_DAYS_AFTER),
        },
      });
      subscriptionBySeller.set(sellerId, subscriptionId);
    }

    const creativeId = uuidv7();
    await db.adCreative.create({
      data: {
        id: creativeId,
        sellerId,
        slotCode: ad.slot,
        mediaType: ad.media.kind,
        fileKey:
          ad.media.kind === 'model3d'
            ? `procedural:${ad.media.model3dKind ?? 'jar'}`
            : ad.media.url,
        headline: ad.headline,
        ctaLabel: ad.ctaLabel,
        targetProductId: idFor(product.id),
        status: 'approved',
      },
    });

    const campaignId = idFor(ad.id);
    const sponsoredHere = sponsoredProductSlugs
      .map((slug) => productBySlug.get(slug))
      .filter((p): p is (typeof products)[number] => p?.seller.id === store.id)
      .map((p) => idFor(p.id));
    await db.adCampaign.create({
      data: {
        id: campaignId,
        subscriptionId,
        sellerId,
        name: `${ad.headline} (${ad.slot})`,
        creativeId,
        productIds: sponsoredHere,
        status: 'live',
        startAt: utcDay(-BOOKING_DAYS_BEFORE),
        endAt: utcDay(BOOKING_DAYS_AFTER),
      },
    });

    const slotKey =
      ad.slot === 'category_banner'
        ? `category_banner:${categories.find((c) => idFor(c.id) === idFor(product.categoryId))?.slug ?? ''}`
        : ad.slot;
    const slotId = slotIds.get(slotKey);
    if (!slotId) throw new Error(`seed: no slot ${slotKey}`);
    const position = (positionInSlot.get(slotKey) ?? 0) + 1;
    positionInSlot.set(slotKey, position);
    await db.adSlotBooking.createMany({
      data: Array.from({ length: BOOKING_DAYS_BEFORE + BOOKING_DAYS_AFTER + 1 }, (_, i) => ({
        id: uuidv7(),
        slotId,
        campaignId,
        day: utcDay(i - BOOKING_DAYS_BEFORE),
        position,
      })),
    });
  }

  for (const scene of heroScenes) {
    await db.cmsHeroScene.create({
      data: {
        id: idFor(scene.id),
        sortOrder: scene.sortOrder,
        title: scene.title,
        subtitle: scene.subtitle,
        mediaKey: scene.poster.url,
        campaignId: scene.ad ? idFor(scene.ad.id) : null,
      },
    });
  }
  log(
    `${servedAds.length} live ad campaigns booked for ${BOOKING_DAYS_AFTER} days, ${heroScenes.length} hero scene`,
  );
}

/** Already seeded: (re)apply SEED_DEMO_PASSWORD to the demo accounts and add a missing admin. */
async function refreshDemoAccounts(db: PrismaClient) {
  await ensureSuperAdmin(db);
  if (!passwordHash) return;
  const emails = [
    ...stores.map((s) => `owner@${s.slug}.test`),
    ...Object.values(DEMO_CUSTOMERS).map((c) => c.email),
    ...(process.env.SEED_ADMIN_EMAIL ? [process.env.SEED_ADMIN_EMAIL.trim().toLowerCase()] : []),
  ];
  const updated = await db.user.updateMany({
    where: { email: { in: emails }, deletedAt: null },
    data: { passwordHash, failedLogins: 0, lockedUntil: null },
  });
  await db.user.updateMany({
    where: { email: { in: emails }, emailVerifiedAt: null },
    data: { emailVerifiedAt: new Date() },
  });
  log(`demo password applied to ${updated.count} accounts`);
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed: refusing to run with NODE_ENV=production');
  }
  const db = new PrismaClient();
  try {
    passwordHash = await demoPasswordHash();
    if ((await db.category.count()) > 0) {
      await refreshDemoAccounts(db);
      log('catalogue already present — nothing else to do');
      return;
    }
    await db.$transaction(
      async (tx) => {
        await seedReferenceData(tx);
        await seedCatalogue(tx);
        await seedShipping(tx);
        await seedReviews(tx);
        await seedAds(tx);
      },
      { timeout: 60_000 },
    );
    log('done');
  } finally {
    await db.$disconnect();
  }
}

await main();

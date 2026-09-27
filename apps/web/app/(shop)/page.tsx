import { formatMoney, getApi } from '@hb/sdk';
import type { ProductCard } from '@hb/types';
import type { HeroProduct } from '@hb/three/3d';
import { Carousel, SectionHeading } from '@hb/ui';
import { SidebarAd3D } from '@/components/ads/sidebar-ad-3d';
import { SidebarAdVideo } from '@/components/ads/sidebar-ad-video';
import { CategoryCircles } from '@/components/home/category-circles';
import { CinematicHero, type HeroAd } from '@/components/home/cinematic-hero';
import { HeroFallback } from '@/components/home/hero-fallback';
import { LovedByShoppers } from '@/components/home/loved-by-shoppers';
import { NewArrivals } from '@/components/home/new-arrivals';
import { OfferBanner } from '@/components/home/offer-banner';
import { OfficialBrands } from '@/components/home/official-brands';
import { ShopProductCard } from '@/components/product/shop-product-card';
import { SITE } from '@/lib/site';

/** Trending carousel length (docs/p4-home.md §2). */
const TRENDING = 12;
/** Hero orbit candidates: best sellers with a 3D model. */
const BEST_SELLERS = 24;

const DUO: readonly [HeroProduct, HeroProduct] = [
  { kind: 'lipstick', shadeHex: '#C2185B' },
  { kind: 'compact', shadeHex: '#F48FB1' },
];

async function heroData(bestSellers: readonly ProductCard[]) {
  const api = getApi();
  const [scene] = await api.getHeroScenes();

  // Three vendor products with 3D orbit in during scene 3 (their procedural model kind + first shade).
  const withModels = await Promise.all(
    bestSellers.filter((p) => p.has3d).map((p) => api.getProduct(p.slug)),
  );
  const orbit: HeroProduct[] = [];
  for (const p of withModels) {
    const kind = p?.media.find((m) => m.model3dKind)?.model3dKind;
    if (p && kind && !orbit.some((o) => o.kind === kind)) {
      orbit.push({ kind, shadeHex: p.shades[0]?.hex ?? '#C2185B' });
    }
    if (orbit.length === 3) break;
  }

  const served = scene?.ad ?? null;
  const adProduct = served?.productSlug ? await api.getProduct(served.productSlug) : null;
  const ad: HeroAd | null = served
    ? {
        headline: served.headline,
        sellerName: served.sellerName,
        href: served.href,
        ctaLabel: served.ctaLabel,
        priceLabel: adProduct ? formatMoney(adProduct.price) : null,
        product: served.media.model3dKind
          ? { kind: served.media.model3dKind, shadeHex: served.media.shadeHex ?? '#F8BBD9' }
          : null,
      }
    : null;

  return { scene, orbit, ad };
}

export default async function HomePage() {
  const api = getApi();
  const best = api.getProducts({ sort: 'best_selling', limit: BEST_SELLERS });
  const [
    categories,
    bestSellers,
    { scene, orbit, ad },
    newest,
    featuredBrands,
    brands,
    reviews,
    stats,
    leftAds,
    rightAds,
  ] = await Promise.all([
    api.getCategories(),
    best,
    best.then((b) => heroData(b.items)),
    api.getProducts({ sort: 'newest', limit: 8 }),
    api.getFeaturedBrands(),
    api.getBrands(),
    api.getFeaturedReviews(3),
    api.getStorefrontStats(),
    api.getAdSlots('left_3d'),
    api.getAdSlots('right_video'),
  ]);
  const trending = bestSellers.items.slice(0, TRENDING);

  return (
    <>
      <CinematicHero
        title={scene?.title ?? SITE.tagline}
        subtitle={scene?.subtitle ?? SITE.description}
        ad={ad}
        duo={DUO}
        orbit={orbit}
        fallback={<HeroFallback scene={scene} />}
      />
      <div id="after-hero" tabIndex={-1} className="scroll-mt-24" />

      {/*
        docs/p4-home.md §1: from 1280 px the sponsored rails stay sticky beside the sections;
        below that the same ads are in-feed cards (3D after categories, video after trending).
        The hidden copy is display:none, so its WebGL stage or video never starts.
      */}
      <div className="mx-auto w-full max-w-[1440px] px-4 py-16 md:px-6 md:py-20 lg:grid lg:grid-cols-[240px_minmax(0,1fr)_240px] lg:gap-8">
        <aside aria-label="Sponsored 3D ad" className="hidden lg:block">
          <SidebarAd3D variant="rail" ads={leftAds} className="sticky top-24" />
        </aside>

        <div className="@container flex min-w-0 flex-col gap-16 md:gap-20">
          <section aria-labelledby="categories-title">
            <SectionHeading
              eyebrow="Explore"
              title={<span id="categories-title">Shop by category</span>}
            />
            <CategoryCircles categories={categories} />
          </section>

          <SidebarAd3D variant="inline" ads={leftAds} className="lg:hidden" />

          {trending.length > 0 ? (
            <section aria-labelledby="trending-title">
              <Carousel
                label="Trending now"
                header={
                  <SectionHeading
                    eyebrow="Best sellers"
                    title={<span id="trending-title">Trending now</span>}
                    className="mb-0"
                  />
                }
                itemClassName="w-[70%] @md:w-[44%] @2xl:w-[30%] @4xl:w-[calc((100%-4.5rem)/4)]"
              >
                {trending.map((p) => (
                  <ShopProductCard
                    key={p.id}
                    product={p}
                    headingLevel="h3"
                    sizes="(min-width: 1280px) 260px, (min-width: 768px) 30vw, 70vw"
                    className="h-full"
                  />
                ))}
              </Carousel>
            </section>
          ) : null}

          <SidebarAdVideo variant="inline" ads={rightAds} className="lg:hidden" />

          <OfficialBrands featured={featuredBrands} brands={brands} />
          <NewArrivals products={newest.items} />
          <OfferBanner />
          <LovedByShoppers reviews={reviews} stats={stats} />
        </div>

        <aside aria-label="Sponsored video ad" className="hidden lg:block">
          <SidebarAdVideo variant="rail" ads={rightAds} className="sticky top-24" />
        </aside>
      </div>
    </>
  );
}

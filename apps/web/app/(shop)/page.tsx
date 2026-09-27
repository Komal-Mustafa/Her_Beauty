import { formatMoney, getApi } from '@hb/sdk';
import type { HeroScene, ProductCard } from '@hb/types';
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
import { optional } from '@/lib/optional';
import { SITE } from '@/lib/site';

/** Trending carousel length (docs/p4-home.md §2). */
const TRENDING = 12;
/** Hero orbit candidates: best sellers with a 3D model. */
const BEST_SELLERS = 24;

const DUO: readonly [HeroProduct, HeroProduct] = [
  { kind: 'lipstick', shadeHex: '#C2185B' },
  { kind: 'compact', shadeHex: '#F48FB1' },
];

async function heroData(scene: HeroScene | undefined, bestSellers: readonly ProductCard[]) {
  const api = getApi();
  const served = scene?.ad ?? null;

  // Three vendor products with 3D orbit in during scene 3 (their procedural model kind + first
  // shade), looked up alongside the hero ad's product.
  const [withModels, adProduct] = await Promise.all([
    Promise.all(
      bestSellers
        .filter((p) => p.has3d)
        .map((p) => optional(`product ${p.slug}`, api.getProduct(p.slug), null)),
    ),
    served?.productSlug
      ? optional('hero ad product', api.getProduct(served.productSlug), null)
      : null,
  ]);
  const orbit: HeroProduct[] = [];
  for (const p of withModels) {
    const kind = p?.media.find((m) => m.model3dKind)?.model3dKind;
    if (p && kind && !orbit.some((o) => o.kind === kind)) {
      orbit.push({ kind, shadeHex: p.shades[0]?.hex ?? '#C2185B' });
    }
    if (orbit.length === 3) break;
  }

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
  const scenes = optional('hero scenes', api.getHeroScenes(), []);
  // Categories and product lists are the page; everything else is optional and falls back.
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
    Promise.all([scenes, best]).then(([[first], b]) => heroData(first, b.items)),
    api.getProducts({ sort: 'newest', limit: 8 }),
    optional('featured brands', api.getFeaturedBrands(), []),
    optional('brands', api.getBrands(), []),
    optional('featured reviews', api.getFeaturedReviews(3), []),
    optional('storefront stats', api.getStorefrontStats(), null),
    optional('left_3d ads', api.getAdSlots('left_3d'), []),
    optional('right_video ads', api.getAdSlots('right_video'), []),
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
        The hidden copy is display:none, so its WebGL stage or video never starts. An empty
        slot shows our own "Advertise with Her Beauty" card, which is not labelled Sponsored.
      */}
      <div className="mx-auto w-full max-w-[1440px] px-4 py-16 md:px-6 md:py-20 lg:grid lg:grid-cols-[240px_minmax(0,1fr)_240px] lg:gap-8">
        <aside
          aria-label={leftAds.length ? 'Sponsored 3D ad' : 'Advertise with Her Beauty'}
          className="hidden lg:block"
        >
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

          {/*
            Not a <section>: the Carousel is already a region named "Trending now". The negative
            bottom margin takes back the room the track keeps for the lifted card's shadow.
          */}
          {trending.length > 0 ? (
            <div className="-mb-6">
              <Carousel
                label="Trending now"
                header={
                  <SectionHeading
                    eyebrow="Best sellers"
                    title={<span id="trending-title">Trending now</span>}
                    className="mb-3"
                  />
                }
                itemClassName="w-[70%] @md:w-[44%] @2xl:w-[calc((100%-3rem)/3)] @4xl:w-[calc((100%-4.5rem)/4)]"
                trackClassName="lg:mx-0 lg:px-0 lg:scroll-px-0"
              >
                {trending.map((p) => (
                  <ShopProductCard
                    key={p.id}
                    product={p}
                    headingLevel="h3"
                    sizes="(min-width: 1280px) 280px, (min-width: 768px) 30vw, 70vw"
                    className="h-full"
                  />
                ))}
              </Carousel>
            </div>
          ) : null}

          <SidebarAdVideo variant="inline" ads={rightAds} className="lg:hidden" />

          <OfficialBrands featured={featuredBrands} brands={brands} />
          <NewArrivals products={newest.items} />
          <OfferBanner />
          <LovedByShoppers reviews={reviews} stats={stats} />
        </div>

        <aside
          aria-label={rightAds.length ? 'Sponsored video ad' : 'Advertise with Her Beauty'}
          className="hidden lg:block"
        >
          <SidebarAdVideo variant="rail" ads={rightAds} className="sticky top-24" />
        </aside>
      </div>
    </>
  );
}

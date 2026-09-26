import { formatMoney, getApi } from '@hb/sdk';
import type { HeroProduct } from '@hb/three/3d';
import { Container, Reveal, SectionHeading } from '@hb/ui';
import Image from 'next/image';
import Link from 'next/link';
import { CinematicHero, type HeroAd } from '@/components/home/cinematic-hero';
import { HeroFallback } from '@/components/home/hero-fallback';
import { SITE } from '@/lib/site';

const DUO: readonly [HeroProduct, HeroProduct] = [
  { kind: 'lipstick', shadeHex: '#C2185B' },
  { kind: 'compact', shadeHex: '#F48FB1' },
];

async function heroData() {
  const api = getApi();
  const [[scene], trending] = await Promise.all([
    api.getHeroScenes(),
    api.getProducts({ sort: 'best_selling', limit: 24 }),
  ]);

  // Three vendor products with 3D orbit in during scene 3 (their procedural model kind + first shade).
  const withModels = await Promise.all(
    trending.items.filter((p) => p.has3d).map((p) => api.getProduct(p.slug)),
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
  const [categories, { scene, orbit, ad }] = await Promise.all([api.getCategories(), heroData()]);

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

      <section aria-labelledby="categories-title" className="py-20">
        <Container>
          <SectionHeading
            eyebrow="Explore"
            title={<span id="categories-title">Shop by category</span>}
          />
          <ul className="grid grid-cols-4 gap-x-4 gap-y-8 md:grid-cols-8">
            {categories.map((c, i) => (
              <Reveal as="li" key={c.id} index={i}>
                <Link
                  href={`/category/${c.slug}`}
                  className="group flex flex-col items-center gap-3 text-center"
                >
                  <span className="relative block aspect-square w-full max-w-[112px] overflow-hidden rounded-pill bg-blush-50 ring-1 ring-ink-200 transition duration-base group-hover:ring-2 group-hover:ring-gold-500">
                    <Image
                      src={c.image.url}
                      alt=""
                      fill
                      sizes="112px"
                      className="object-cover transition duration-slow group-hover:scale-105"
                    />
                  </span>
                  <span className="text-sm font-medium text-ink-900 group-hover:text-pink-600">
                    {c.name}
                  </span>
                </Link>
              </Reveal>
            ))}
          </ul>
        </Container>
      </section>
    </>
  );
}

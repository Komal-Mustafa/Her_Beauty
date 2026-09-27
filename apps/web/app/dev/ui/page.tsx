import { getApi } from '@hb/sdk';
import type { ProductCard } from '@hb/types';
import { Carousel, Container, CountUp, Marquee, SectionHeading } from '@hb/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BrandLogo } from '@/components/home/brand-logo';
import { SiteHeader } from '@/components/layout/site-header';
import { ShopProductCard } from '@/components/product/shop-product-card';
import { PRIMARY_NAV } from '@/lib/nav';

export const metadata: Metadata = { title: 'UI preview', robots: { index: false } };

type Sample = { caption: string; product: ProductCard };

/** Every card state the P4 spec names, from mock data (a few are variations of a real product). */
function samples(products: ProductCard[]): Sample[] {
  const bySlug = (slug: string) => products.find((p) => p.slug === slug);
  const list: (Sample | null)[] = [];
  const add = (caption: string, product: ProductCard | undefined) =>
    list.push(product ? { caption, product } : null);

  add('Sponsored · sale · quick add', bySlug('rose-dusk-palette'));
  add('New · quick add', bySlug('silk-lip-oil'));
  add('3D · sale · choose shade', bySlug('velvet-matte-lipstick'));
  add('3D · new · choose shade', bySlug('satin-glow-lipstick'));
  add('3D · sale · quick add', bySlug('damask-rose-eau-de-parfum'));

  const brush = bySlug('gold-kabuki-brush');
  add('See options (no quick add, no shades)', brush && { ...brush, quickAddVariantId: null });

  // Pool the shades of the lip and cheek products to show the "+n" overflow.
  const lipstick = bySlug('velvet-matte-lipstick');
  const pooled = products
    .flatMap((p) => p.shades)
    .filter((s, i, all) => all.findIndex((o) => o.name === s.name) === i);
  add(
    `${pooled.length} shades (+${pooled.length - 5})`,
    lipstick && { ...lipstick, id: `${lipstick.id}-shades`, shades: pooled },
  );

  const serum = bySlug('vitamin-c-glow-serum');
  add(
    'Long title · sponsored',
    serum && {
      ...serum,
      id: `${serum.id}-long`,
      title:
        'Vitamin C + Niacinamide Brightening Glow Serum with Hyaluronic Acid for Dull and Uneven Skin, 30 ml',
      seller: { ...serum.seller, storeName: 'Skin Lab Pakistan Official Beauty Store' },
    },
  );
  return list.filter((s): s is Sample => s !== null);
}

// Internal preview of the P4 UI primitives. Hidden in production unless explicitly enabled.
export default async function UiPreviewPage() {
  const enabled =
    process.env.NEXT_PUBLIC_ENABLE_DEV_PAGES === 'true' || process.env.NODE_ENV !== 'production';
  if (!enabled) notFound();

  const api = getApi();
  const [categories, all, trending, brands, stores] = await Promise.all([
    api.getCategories(),
    api.getProducts({ limit: 100 }),
    api.getProducts({ sort: 'best_selling', limit: 12 }),
    api.getBrands(),
    api.getStores(),
  ]);
  const stats = [
    { label: 'Verified sellers', value: stores.length },
    { label: 'Official brands', value: brands.filter((b) => b.isProtected).length },
    { label: 'Products', value: all.items.length },
    { label: 'Shopper reviews', value: all.items.reduce((n, p) => n + p.ratingCount, 0) },
  ];

  return (
    <>
      <SiteHeader categories={categories} nav={PRIMARY_NAV} />
      <main id="main" className="pb-24">
        <Container className="py-10">
          <p className="eyebrow mb-2 text-gold-800">Dev preview</p>
          <h1 className="font-display text-[34px] font-semibold text-ink-900 md:text-[56px]">
            P4 UI primitives
          </h1>
          <p className="mt-3 max-w-2xl text-ink-500">
            ProductCard, Carousel, Marquee and CountUp with mock data. Add to cart updates the cart
            count in the header; the heart saves to the wishlist (both in this browser only).
          </p>
        </Container>

        <section aria-labelledby="cards-title" className="py-10">
          <Container>
            <SectionHeading
              eyebrow="Product card"
              title={<span id="cards-title">Card states</span>}
            />
            <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 md:gap-x-6">
              {samples(all.items).map(({ caption, product }, i) => (
                <li key={product.id} className="flex flex-col gap-2">
                  <p className="text-xs font-medium text-ink-500">{caption}</p>
                  <ShopProductCard product={product} priority={i < 2} className="flex-1" />
                </li>
              ))}
            </ul>
          </Container>
        </section>

        <section aria-labelledby="trending-title" className="bg-blush-50 py-12">
          <Container>
            <Carousel
              label="Trending now"
              header={
                <SectionHeading
                  eyebrow="Carousel"
                  title={<span id="trending-title">Trending now</span>}
                  className="mb-0"
                />
              }
            >
              {trending.items.map((p) => (
                <ShopProductCard key={p.id} product={p} />
              ))}
            </Carousel>
          </Container>
        </section>

        <section aria-labelledby="brands-title" className="py-12">
          <Container>
            <SectionHeading
              eyebrow="Marquee"
              title={<span id="brands-title">Official brands</span>}
            />
            <Marquee
              label="Official brands"
              pauseLabel="Pause brand logos"
              playLabel="Play brand logos"
            >
              {brands.map((b) => (
                <BrandLogo key={b.id} brand={b} />
              ))}
            </Marquee>
          </Container>
        </section>

        <section aria-labelledby="stats-title" className="py-12">
          <Container>
            <SectionHeading
              eyebrow="Count up"
              title={<span id="stats-title">Loved by shoppers</span>}
            />
            <dl className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="flex flex-col-reverse items-center gap-1 rounded-card border border-gold-500 bg-white px-4 py-6 text-center"
                >
                  <dt className="text-sm text-ink-500">{s.label}</dt>
                  <dd className="font-display text-[28px] font-semibold text-pink-600 md:text-[40px]">
                    <CountUp value={s.value} />
                  </dd>
                </div>
              ))}
            </dl>
          </Container>
        </section>
      </main>
    </>
  );
}

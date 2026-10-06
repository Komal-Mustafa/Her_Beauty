import { getApi } from '@hb/sdk';
import type { Paged, ProductCard } from '@hb/types';
import { Container, TrustStrip } from '@hb/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { BuyBox } from '@/components/product/buy-box';
import { DeliveryPanel } from '@/components/product/delivery-panel';
import { ProductCarousel } from '@/components/product/product-carousel';
import { ProductProvider } from '@/components/product/product-context';
import { ProductDetails } from '@/components/product/product-details';
import { ProductGallery } from '@/components/product/product-gallery';
import { ProductReviews } from '@/components/product/product-reviews';
import { RecentlyViewed } from '@/components/product/recently-viewed';
import { RecordProductView } from '@/components/product/record-view';
import { SellerCard } from '@/components/product/seller-card';
import { StickyBuyBar } from '@/components/product/sticky-buy-bar';
import { initialVariant } from '@/components/product/variant-selection';
import { optional } from '@/lib/optional';
import { descriptionText, excerpt } from '@/lib/sanitize';
import { breadcrumbJsonLd, productJsonLd, type Crumb } from '@/lib/seo/json-ld';
import { JsonLd } from '@/lib/seo/json-ld-script';
import { SITE } from '@/lib/site';
import { deliveryEstimate, recentlyViewedCards } from './actions';
import { loadProduct } from './load-product';

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Cards per carousel under the product. */
const CAROUSEL = 12;
const NO_PRODUCTS: Paged<ProductCard> = { items: [], nextCursor: null };

/** Up to CAROUSEL other products (the page's own product is left out). */
function others(page: Paged<ProductCard>, productId: string): ProductCard[] {
  return page.items.filter((p) => p.id !== productId).slice(0, CAROUSEL);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await loadProduct(slug);
  if (!product) return { title: 'Product not found' };

  const title = `${product.title} by ${product.brand.name} | ${SITE.name}`;
  const description =
    excerpt(descriptionText(product.descriptionHtml)) ||
    `${product.title} by ${product.brand.name}, sold by ${product.seller.storeName} on ${SITE.name}.`;
  const [image] = product.images;
  // Canonical is the bare product URL: `?shade=` only preselects a variant of the same page.
  const url = `/product/${product.slug}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      siteName: SITE.name,
      locale: 'en_PK',
      url,
      title,
      description,
      images: image
        ? [{ url: image.url, width: image.width, height: image.height, alt: image.alt }]
        : undefined,
    },
  };
}

/**
 * Product page (docs/p5-catalog.md §5): gallery and buy box with the delivery estimate, details,
 * reviews and three carousels. The product is required (unknown → 404, settled by layout.tsx
 * before streaming starts); everything else is `optional()` and hides or falls back when it
 * fails. The delivery estimate and Recently viewed depend on the shopper's browser (city and
 * history in localStorage), so they load on the client through the server actions in actions.ts.
 */
export default async function ProductPage({ params, searchParams }: PageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const product = await loadProduct(slug);
  if (!product) notFound();

  const api = getApi();
  const categories = optional('categories', api.getCategories(), []);
  const category = categories.then((all) => all.find((c) => c.id === product.categoryId));
  const [reviews, store, fromStore, similar, cat] = await Promise.all([
    optional('reviews', api.getReviews(product.id), null),
    optional('store', api.getStore(product.seller.slug), null),
    optional(
      'more from store',
      api.getProducts({ seller: product.seller.slug, limit: CAROUSEL + 1 }),
      NO_PRODUCTS,
    ),
    category.then((c) =>
      c
        ? optional(
            'similar products',
            api.getProducts({ category: c.slug, sort: 'best_selling', limit: CAROUSEL + 1 }),
            NO_PRODUCTS,
          )
        : NO_PRODUCTS,
    ),
    category,
  ]);

  const crumbs: Crumb[] = [
    { label: 'Home', href: '/' },
    ...(cat ? [{ label: cat.name, href: `/category/${cat.slug}` }] : []),
    { label: product.title, href: `/product/${product.slug}` },
  ];
  const newestReviews = reviews
    ? [...reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];
  const variant = initialVariant(product, query.shade);

  return (
    <ProductProvider product={product} initialVariantId={variant.id}>
      <JsonLd
        data={[
          productJsonLd({
            product,
            description: descriptionText(product.descriptionHtml),
            reviews: newestReviews,
          }),
          breadcrumbJsonLd(crumbs),
        ]}
      />
      <RecordProductView productId={product.id} productSlug={product.slug} />

      <Container className="pb-16 pt-2 md:pb-24">
        <Breadcrumbs items={crumbs} className="mb-2" />

        <div className="md:grid md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:items-start md:gap-12">
          <ProductGallery />
          <div className="mt-8 md:sticky md:top-24 md:mt-0">
            <BuyBox>
              <DeliveryPanel productSlug={product.slug} getEstimate={deliveryEstimate} />
              <SellerCard seller={product.seller} store={store} />
              <TrustStrip className="md:grid-cols-1" />
            </BuyBox>
          </div>
        </div>

        <ProductDetails product={product} className="mt-16 md:mt-24" />

        <div className="mt-16 md:mt-24">
          <ProductReviews product={product} reviews={reviews} />
        </div>

        <div className="mt-16 flex flex-col gap-16 md:mt-24 md:gap-20">
          <ProductCarousel
            id="more-from-store"
            eyebrow="From the store"
            title={`More from ${product.seller.storeName}`}
            products={others(fromStore, product.id)}
          />
          <ProductCarousel
            id="similar"
            eyebrow="You may also like"
            title="Similar products"
            products={others(similar, product.id)}
          />
          <RecentlyViewed productId={product.id} loadCards={recentlyViewedCards} />
        </div>
      </Container>

      <StickyBuyBar />
    </ProductProvider>
  );
}

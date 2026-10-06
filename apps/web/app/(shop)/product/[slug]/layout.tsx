import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { hasGalleryTabs } from '@/components/product/gallery-media';
import { loadProduct } from './load-product';

type ProductLayoutProps = {
  children: ReactNode;
  params: Promise<{ slug: string }>;
};

/**
 * Settles whether the product exists before anything is sent. `loading.tsx` wraps the page (not
 * this layout) in Suspense, so the page starts streaming with a 200 status; a `notFound()` thrown
 * there would come too late to change it. Thrown here, an unknown slug is a real 404 with the
 * not-found page. The read is shared with `generateMetadata` and the page (`loadProduct` is cached
 * per request).
 *
 * Knowing the product here also lets the skeleton match it: `data-gallery-tabs` tells
 * `loading.tsx` (inside this layout, prefetched with it) whether the gallery has a tab bar, so the
 * gallery does not jump when the page replaces the skeleton. `contents`: no box of its own.
 */
export default async function ProductLayout({ children, params }: ProductLayoutProps) {
  const { slug } = await params;
  const product = await loadProduct(slug);
  if (!product) notFound();
  return (
    <div
      className="group/product contents"
      data-gallery-tabs={hasGalleryTabs(product) || undefined}
    >
      {children}
    </div>
  );
}

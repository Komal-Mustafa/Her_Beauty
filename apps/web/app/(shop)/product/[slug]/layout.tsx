import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
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
 */
export default async function ProductLayout({ children, params }: ProductLayoutProps) {
  const { slug } = await params;
  if (!(await loadProduct(slug))) notFound();
  return children;
}

import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { loadBrand } from './load-brand';

type BrandLayoutProps = {
  children: ReactNode;
  params: Promise<{ slug: string }>;
};

/** An unknown brand is a real 404, settled before the page streams (see the category layout). */
export default async function BrandLayout({ children, params }: BrandLayoutProps) {
  const { slug } = await params;
  if (!(await loadBrand(slug))) notFound();
  return children;
}

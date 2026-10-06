import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { loadStore } from './load-store';

type StoreLayoutProps = {
  children: ReactNode;
  params: Promise<{ slug: string }>;
};

/** An unknown store is a real 404, settled before the page streams (see the category layout). */
export default async function StoreLayout({ children, params }: StoreLayoutProps) {
  const { slug } = await params;
  if (!(await loadStore(slug))) notFound();
  return children;
}

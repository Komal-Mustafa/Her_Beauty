import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { loadCategory } from './load-category';

type CategoryLayoutProps = {
  children: ReactNode;
  params: Promise<{ slug: string }>;
};

/**
 * Settles whether the category exists before anything is sent, so an unknown slug is a real 404
 * (the page streams inside `loading.tsx`'s Suspense, too late to change the status; see the
 * product page's layout).
 */
export default async function CategoryLayout({ children, params }: CategoryLayoutProps) {
  const { slug } = await params;
  if (!(await loadCategory(slug))) notFound();
  return children;
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Playground } from './playground';

export const metadata: Metadata = { title: '3D playground', robots: { index: false } };

// Internal test bench for the P2 3D foundation. Hidden in production unless explicitly enabled.
export default function ThreeDPlaygroundPage() {
  const enabled =
    process.env.NEXT_PUBLIC_ENABLE_DEV_PAGES === 'true' || process.env.NODE_ENV !== 'production';
  if (!enabled) notFound();
  return <Playground />;
}

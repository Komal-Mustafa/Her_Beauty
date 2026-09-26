import { Logo } from '@hb/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PortalNav } from '@/components/portal/portal-nav';

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Signed-in shell. Pages check the session themselves (auth.requireSession) and the middleware
 * refreshes it first; this layout reads nothing, so it never blocks on the API.
 * No loading.tsx here: pages in this group post server actions (packages/auth/README.md).
 */
export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-blush-50">
      <a
        href="#main"
        className="sr-only z-50 rounded-btn bg-white px-4 py-2 text-sm font-medium text-pink-700 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 md:px-6">
          <Link href="/dashboard" prefetch={false} aria-label="Seller portal home">
            <Logo />
          </Link>
          <p className="eyebrow hidden text-gold-800 sm:block">Seller portal</p>
          <PortalNav className="-mx-1 w-full sm:mx-0 sm:ml-auto sm:w-auto" />
        </div>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto max-w-[1280px] px-4 py-8 focus:outline-none md:px-6 md:py-12"
      >
        {children}
      </main>
    </div>
  );
}

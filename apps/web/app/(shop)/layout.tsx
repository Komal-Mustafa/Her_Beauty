import type { ReactNode } from 'react';
import { getApi } from '@hb/sdk';
import { AnnouncementBar } from '@/components/layout/announcement-bar';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { FOOTER_NAV, PRIMARY_NAV } from '@/lib/nav';

export default async function ShopLayout({ children }: { children: ReactNode }) {
  const categories = await getApi().getCategories();
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-btn focus:bg-white focus:px-4 focus:py-2 focus:shadow-lift"
      >
        Skip to content
      </a>
      <AnnouncementBar />
      <SiteHeader categories={categories} nav={PRIMARY_NAV} />
      <main id="main">{children}</main>
      <SiteFooter groups={FOOTER_NAV} />
    </>
  );
}

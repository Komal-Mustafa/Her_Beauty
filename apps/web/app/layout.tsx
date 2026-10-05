import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { ToastProvider } from '@hb/ui';
import { SmoothScroll } from '@/components/layout/smooth-scroll';
import { websiteJsonLd } from '@/lib/seo/json-ld';
import { JsonLd } from '@/lib/seo/json-ld-script';
import { SITE } from '@/lib/site';
import { fontVariables } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name} — Premium beauty marketplace`, template: `%s · ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  openGraph: { type: 'website', siteName: SITE.name, locale: 'en_PK' },
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#C2185B',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="min-h-dvh bg-white">
        {/* The site and its search box for search engines (docs/p5-catalog.md §10). */}
        <JsonLd data={websiteJsonLd()} />
        <ToastProvider>
          {children}
          <SmoothScroll />
        </ToastProvider>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ToastProvider } from '@hb/ui';
import { fontVariables } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Her Beauty Admin', template: '%s · HB Admin' },
  robots: { index: false, follow: false },
  icons: { icon: '/icon.svg' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="min-h-dvh bg-blush-50">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

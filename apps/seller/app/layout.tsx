import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ToastProvider } from '@hb/ui';
import { fontVariables } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Her Beauty Seller Portal', template: '%s · HB Seller' },
  description: 'Sell and advertise on Her Beauty — for vendors and manufacturers.',
  robots: { index: false, follow: false },
  icons: { icon: '/icon.svg' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="min-h-dvh bg-white">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

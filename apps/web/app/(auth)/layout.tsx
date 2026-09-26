import { Logo, TrustStrip } from '@hb/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** 04-ui-ux §6: split screen — grad-pink brand panel with trust points, white form side. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="grid min-h-dvh md:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-grad-pink p-12 md:flex">
        <Link href="/" aria-label="Her Beauty home" className="self-start">
          <Logo />
        </Link>
        <div className="max-w-md animate-rise">
          <p className="eyebrow mb-3 text-gold-800">Her Beauty, Her Story</p>
          <p className="font-display text-[48px] font-semibold leading-[1.05] text-ink-900">
            Genuine beauty, <span className="text-grad-rose">protected</span> until it arrives
          </p>
        </div>
        <TrustStrip compact />
      </section>
      <section className="flex justify-center px-4 py-10 sm:py-16 md:items-center">
        <div className="w-full max-w-sm">
          <Link href="/" aria-label="Her Beauty home" className="mb-10 inline-block md:hidden">
            <Logo />
          </Link>
          {children}
        </div>
      </section>
    </main>
  );
}

import { Logo } from '@hb/ui';
import { ShieldCheck, Truck, WalletCards } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata: Metadata = { robots: { index: false, follow: false } };

const SELLER_POINTS = [
  {
    icon: ShieldCheck,
    title: 'Protected brands',
    body: 'Only the brand owner and sellers it authorises can list it',
  },
  {
    icon: WalletCards,
    title: 'Safe payments',
    body: 'Buyers pay up front; we release the money after delivery',
  },
  { icon: Truck, title: 'Your own courier', body: 'Ship with the courier account you already use' },
] as const;

/**
 * 04-ui-ux §6.5 seller login: split screen, grad-pink brand panel with 3 trust points, white
 * form side. P7 adds the slow 3D compact to the panel.
 */
export default function SellerAuthLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="grid min-h-dvh md:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-grad-pink p-12 md:flex">
        <Link href="/" aria-label="Her Beauty seller portal" className="self-start">
          <Logo />
        </Link>
        <div className="max-w-md animate-rise">
          <p className="eyebrow mb-3 text-gold-800">Seller portal</p>
          <p className="font-display text-[56px] font-semibold leading-[1.05] text-ink-900">
            Grow your beauty brand with <span className="text-grad-rose">Her Beauty</span>
          </p>
        </div>
        <ul className="grid gap-4">
          {SELLER_POINTS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-start gap-3">
              <Icon
                aria-hidden
                className="mt-0.5 h-6 w-6 shrink-0 text-gold-600"
                strokeWidth={1.5}
              />
              <div>
                <p className="text-sm font-medium text-ink-900">{title}</p>
                <p className="text-sm text-ink-500">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="flex justify-center px-4 py-10 sm:py-16 md:items-center">
        <div className="w-full max-w-md">
          <Link
            href="/"
            aria-label="Her Beauty seller portal"
            className="mb-10 inline-block md:hidden"
          >
            <Logo />
          </Link>
          {children}
        </div>
      </section>
    </main>
  );
}

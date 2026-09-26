'use client';

import { cn } from '@hb/ui';
import { LayoutDashboard, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/security', label: 'Security', icon: ShieldCheck },
] as const;

/**
 * Portal sections (04-ui-ux §6.5: pink active item with a gold bar). Protected pages, so no
 * prefetch: a prefetch cannot refresh a session and would only fetch a login redirect.
 */
export function PortalNav({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Seller portal" className={className}>
      <ul className="flex gap-1">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                prefetch={false}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative inline-flex min-h-11 items-center gap-2 rounded-btn px-3 text-sm font-medium transition-colors duration-fast motion-reduce:transition-none',
                  active
                    ? 'bg-pink-100 text-pink-700'
                    : 'text-ink-900 hover:bg-blush-50 hover:text-pink-600',
                )}
              >
                <Icon aria-hidden className="h-4 w-4" />
                {label}
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-3 bottom-1 h-0.5 rounded-pill bg-gold-500"
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

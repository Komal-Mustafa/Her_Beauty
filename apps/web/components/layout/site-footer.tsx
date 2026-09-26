import type { NavGroup } from '@hb/types';
import { Container, GoldDivider, Logo, TrustStrip } from '@hb/ui';
import Link from 'next/link';
import { PAYMENT_METHODS } from '@/lib/nav';
import { SITE } from '@/lib/site';

/** 04-ui-ux §6.1: blush-50 background, gold divider flourish, links, payment logos. */
export function SiteFooter({ groups }: { groups: NavGroup[] }) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 bg-blush-50">
      <Container className="py-12">
        <TrustStrip />
      </Container>
      <GoldDivider className="mx-auto max-w-[1280px] px-4 md:px-6" />
      <Container className="grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-ink-500">{SITE.description}</p>
        </div>
        {groups.map((g) => (
          <nav key={g.title} aria-label={g.title}>
            <h2 className="eyebrow mb-4 text-gold-800">{g.title}</h2>
            <ul className="space-y-2.5">
              {g.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-ink-900 transition hover:text-pink-600"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </Container>
      <div className="border-t border-ink-200">
        <Container className="flex flex-col gap-4 py-6 text-xs text-ink-500 md:flex-row md:items-center md:justify-between">
          <p>© {year} Her Beauty. All prices in PKR.</p>
          <ul aria-label="Payment methods we accept" className="flex flex-wrap gap-2">
            {PAYMENT_METHODS.map((m) => (
              <li
                key={m}
                className="rounded-pill border border-ink-200 bg-white px-3 py-1 text-ink-900"
              >
                {m}
              </li>
            ))}
          </ul>
        </Container>
      </div>
    </footer>
  );
}

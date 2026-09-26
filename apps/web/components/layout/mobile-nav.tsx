'use client';

import type { Category, NavLink } from '@hb/types';
import { Modal } from '@hb/ui';
import Link from 'next/link';
import { SearchForm } from './search-form';

type MobileNavProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  nav: NavLink[];
};

export function MobileNav({ open, onOpenChange, categories, nav }: MobileNavProps) {
  const close = () => onOpenChange(false);
  const linkClass =
    'flex min-h-11 items-center rounded-btn px-3 text-[15px] text-ink-900 hover:bg-blush-50 hover:text-pink-700';
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Menu" placement="right">
      <SearchForm id="mobile-search" className="mb-6" />
      <nav aria-label="Mobile">
        <p className="eyebrow mb-2 px-3 text-gold-800">Shop by category</p>
        <ul className="mb-6">
          {categories.map((c) => (
            <li key={c.id}>
              <Link href={`/category/${c.slug}`} onClick={close} className={linkClass}>
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
        <p className="eyebrow mb-2 px-3 text-gold-800">Discover</p>
        <ul className="mb-6">
          {nav.map((l) => (
            <li key={l.href}>
              <Link href={l.href} onClick={close} className={linkClass}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <p className="eyebrow mb-2 px-3 text-gold-800">Your account</p>
        <ul>
          <li>
            <Link href="/account" prefetch={false} onClick={close} className={linkClass}>
              Account
            </Link>
          </li>
          <li>
            <Link href="/account/orders" onClick={close} className={linkClass}>
              My orders
            </Link>
          </li>
          <li>
            <Link href="/account/wishlist" onClick={close} className={linkClass}>
              Wishlist
            </Link>
          </li>
          <li>
            <Link href="/become-a-seller" onClick={close} className={linkClass}>
              Sell on Her Beauty
            </Link>
          </li>
        </ul>
      </nav>
    </Modal>
  );
}

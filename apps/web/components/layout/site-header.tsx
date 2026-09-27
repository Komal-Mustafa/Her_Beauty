'use client';

import type { Category, NavLink } from '@hb/types';
import { cn, Logo } from '@hb/ui';
import { ChevronDown, Heart, Menu, Search, User } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { CartLink } from './cart-link';
import { MobileNav } from './mobile-nav';
import { SearchForm } from './search-form';

type SiteHeaderProps = { categories: Category[]; nav: NavLink[] };

const iconLink =
  'relative grid h-11 w-11 place-items-center rounded-pill text-ink-900 transition duration-fast hover:bg-blush-50 hover:text-pink-600';

export function SiteHeader({ categories, nav }: SiteHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [menuOpen]);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b bg-white/95 backdrop-blur transition-[box-shadow,border-color] duration-base',
        scrolled ? 'border-ink-200 shadow-soft' : 'border-transparent',
      )}
    >
      <div
        className={cn(
          'mx-auto flex max-w-[1280px] items-center gap-3 px-4 transition-[height] duration-base md:gap-6 md:px-6',
          scrolled ? 'h-16' : 'h-20',
        )}
      >
        <button
          type="button"
          className={cn(iconLink, 'lg:hidden')}
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
        >
          <Menu aria-hidden className="h-5 w-5" />
        </button>

        <Link href="/" aria-label="Her Beauty home" className="shrink-0">
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          <div ref={menuRef} className="relative">
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-controls="category-menu"
              onClick={() => setMenuOpen((o) => !o)}
              className="inline-flex h-11 items-center gap-1 rounded-pill px-3 text-sm font-medium text-ink-900 transition hover:text-pink-600"
            >
              Categories
              <ChevronDown
                aria-hidden
                className={cn(
                  'h-4 w-4 transition-transform duration-base',
                  menuOpen && 'rotate-180',
                )}
              />
            </button>
            {menuOpen && (
              <div
                id="category-menu"
                className="absolute left-0 top-full mt-2 w-[520px] rounded-card border border-ink-200 bg-white p-4 shadow-lift animate-rise"
              >
                <ul className="grid grid-cols-2 gap-1">
                  {categories.map((c, i) => (
                    <li
                      key={c.id}
                      className="animate-rise"
                      style={{ animationDelay: `${i * 30}ms` }}
                    >
                      <Link
                        href={`/category/${c.slug}`}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 rounded-btn px-3 py-2.5 text-sm text-ink-900 transition hover:bg-blush-50 hover:text-pink-700"
                      >
                        <span aria-hidden className="h-2 w-2 rotate-45 border border-gold-500" />
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {nav.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="inline-flex h-11 items-center rounded-pill px-3 text-sm font-medium text-ink-900 transition hover:text-pink-600"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <SearchForm className="ml-auto hidden w-full max-w-sm md:block" />

        <div className="ml-auto flex items-center md:ml-0">
          <Link href="/search" aria-label="Search" className={cn(iconLink, 'md:hidden')}>
            <Search aria-hidden className="h-5 w-5" />
          </Link>
          <Link
            href="/account/wishlist"
            aria-label="Wishlist"
            className={cn(iconLink, 'hidden sm:grid')}
          >
            <Heart aria-hidden className="h-5 w-5" />
          </Link>
          {/* Static link: middleware sends logged-out visitors to /login?next=/account. No
              prefetch, so a background request never has to refresh the session. */}
          <Link
            href="/account"
            prefetch={false}
            aria-label="Account"
            className={cn(iconLink, 'hidden sm:grid')}
          >
            <User aria-hidden className="h-5 w-5" />
          </Link>
          <CartLink className={iconLink} />
        </div>
      </div>

      <MobileNav open={mobileOpen} onOpenChange={setMobileOpen} categories={categories} nav={nav} />
    </header>
  );
}

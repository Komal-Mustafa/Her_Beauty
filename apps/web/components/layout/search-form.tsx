import { Search } from 'lucide-react';
import { cn } from '@hb/ui';

type SearchFormProps = {
  className?: string;
  id?: string;
  /**
   * Name of the search landmark. A page with more than one search form names each one
   * differently (the header's is "Site search"), so landmark lists can tell them apart.
   */
  label?: string;
};

/** Plain GET form → /search?q= (works without JS). */
export function SearchForm({ className, id = 'site-search', label }: SearchFormProps) {
  return (
    <form action="/search" role="search" aria-label={label} className={cn('relative', className)}>
      <label htmlFor={id} className="sr-only">
        Search products, brands and sellers
      </label>
      <input
        id={id}
        name="q"
        type="search"
        maxLength={100}
        placeholder="Search lipstick, serum, brands…"
        className="h-11 w-full rounded-pill border border-ink-200 bg-blush-50 pl-11 pr-4 text-sm text-ink-900 transition duration-fast placeholder:text-ink-500 focus:border-pink-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-pink-100"
      />
      <Search
        aria-hidden
        className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500"
      />
    </form>
  );
}

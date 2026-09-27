import type { Brand, FeaturedBrand } from '@hb/types';
import { Marquee, SectionHeading } from '@hb/ui';
import { BrandLogo } from './brand-logo';

/**
 * Home §3 (docs/p4-home.md §2): trademark-verified brands in a slow marquee. Paid placements
 * (Icon "top", then Luxe "featured") come first and say Sponsored; the other official brands
 * follow. Reduced motion: a static wrapped row (Marquee).
 */
export function OfficialBrands({
  featured,
  brands,
}: {
  featured: readonly FeaturedBrand[];
  brands: readonly Brand[];
}) {
  const paid = new Set(featured.map((b) => b.id));
  const rest = brands.filter((b) => b.isProtected && !paid.has(b.id));
  if (featured.length + rest.length === 0) return null;

  return (
    <section aria-labelledby="brands-title">
      <SectionHeading
        eyebrow="Straight from the makers"
        title={<span id="brands-title">Official brands</span>}
        description="Trademark-verified brands, sold by their owners or authorised sellers."
      />
      <Marquee label="Official brands" pauseLabel="Pause brand logos" playLabel="Play brand logos">
        {featured.map((b) => (
          <BrandLogo key={b.id} brand={b} sponsored />
        ))}
        {rest.map((b) => (
          <BrandLogo key={b.id} brand={b} />
        ))}
      </Marquee>
    </section>
  );
}

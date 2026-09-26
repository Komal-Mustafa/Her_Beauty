import { getApi } from '@hb/sdk';
import { Button, Container, Reveal, SectionHeading } from '@hb/ui';
import Image from 'next/image';
import Link from 'next/link';
import { SITE } from '@/lib/site';

/*
 * P1 home shell. The static poster + H1 below is the LCP element and stays as the
 * fallback when the 4D cinematic hero (P3) replaces it on capable devices.
 */
export default async function HomePage() {
  const api = getApi();
  const [categories, [scene]] = await Promise.all([api.getCategories(), api.getHeroScenes()]);

  return (
    <>
      <section aria-labelledby="hero-title" className="relative overflow-hidden bg-grad-pink">
        <Container
          wide
          className="grid min-h-[80vh] items-center gap-10 py-16 md:grid-cols-2 md:py-24"
        >
          <div className="relative z-10 max-w-xl animate-rise">
            <p className="eyebrow mb-4 text-gold-800">Her Beauty</p>
            <h1
              id="hero-title"
              className="font-display text-[40px] font-semibold leading-[1.05] text-ink-900 md:text-[72px]"
            >
              <span className="text-grad-rose">{SITE.tagline}</span>
            </h1>
            <p className="mt-6 max-w-md text-lg text-ink-500">
              {scene?.subtitle ?? SITE.description}
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/new">Shop new arrivals</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/become-a-seller">Sell on Her Beauty</Link>
              </Button>
            </div>
          </div>
          {scene && (
            <div className="relative aspect-[16/9] w-full md:aspect-[4/3]">
              <Image
                src={scene.poster.url}
                alt={scene.poster.alt}
                fill
                priority
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-contain object-center"
              />
            </div>
          )}
        </Container>
      </section>

      <section aria-labelledby="categories-title" className="py-20">
        <Container>
          <SectionHeading
            eyebrow="Explore"
            title={<span id="categories-title">Shop by category</span>}
          />
          <ul className="grid grid-cols-4 gap-x-4 gap-y-8 md:grid-cols-8">
            {categories.map((c, i) => (
              <Reveal as="li" key={c.id} index={i}>
                <Link
                  href={`/category/${c.slug}`}
                  className="group flex flex-col items-center gap-3 text-center"
                >
                  <span className="relative block aspect-square w-full max-w-[112px] overflow-hidden rounded-pill bg-blush-50 ring-1 ring-ink-200 transition duration-base group-hover:ring-2 group-hover:ring-gold-500">
                    <Image
                      src={c.image.url}
                      alt=""
                      fill
                      sizes="112px"
                      className="object-cover transition duration-slow group-hover:scale-105"
                    />
                  </span>
                  <span className="text-sm font-medium text-ink-900 group-hover:text-pink-600">
                    {c.name}
                  </span>
                </Link>
              </Reveal>
            ))}
          </ul>
        </Container>
      </section>
    </>
  );
}

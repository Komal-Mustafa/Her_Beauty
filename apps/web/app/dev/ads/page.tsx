import { getApi } from '@hb/sdk';
import type { ModelKind } from '@hb/three/3d';
import { Container, SectionHeading } from '@hb/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { HouseAd } from '@/components/ads/house-ad';
import { SidebarAd3D } from '@/components/ads/sidebar-ad-3d';
import { SidebarAdVideo } from '@/components/ads/sidebar-ad-video';
import { LoopStage } from './loop-stage';

export const metadata: Metadata = { title: 'Sidebar ads preview', robots: { index: false } };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const KINDS: readonly ModelKind[] = ['lipstick', 'compact', 'perfume', 'jar'];
const TIERS = ['high', 'mid', 'low'] as const;
const SECTIONS = [
  'Shop by category',
  'Trending now',
  'Official brands',
  'New arrivals',
  'Offer banner',
  'Loved by shoppers',
];

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Internal preview of the P4 sidebar ads (docs/p4-home.md §3) with mock data. Hidden in
// production unless explicitly enabled, like /dev/3d.
export default async function AdsPreviewPage({ searchParams }: PageProps) {
  const enabled =
    process.env.NEXT_PUBLIC_ENABLE_DEV_PAGES === 'true' || process.env.NODE_ENV !== 'production';
  if (!enabled) notFound();

  const params = await searchParams;
  if (one(params.loop) !== undefined) {
    const kind = KINDS.find((k) => k === one(params.kind)) ?? 'perfume';
    const shade = one(params.shade);
    // Product shade data, as it would come from the catalogue.
    const shadeHex = shade && /^#[0-9a-f]{6}$/i.test(shade) ? shade : '#F2A07B';
    return <LoopStage label="Her Beauty" kind={kind} shadeHex={shadeHex} />;
  }

  const api = getApi();
  const [left, right] = await Promise.all([
    api.getAdSlots('left_3d'),
    api.getAdSlots('right_video'),
  ]);

  return (
    <Container wide className="py-10">
      <SectionHeading
        eyebrow="Internal"
        title="Sidebar ads"
        description="left_3d and right_video with mock data. From 1280 px the ads sit in sticky rails beside the sections; below that they are full-width cards in the feed."
      />
      <p className="-mt-4 mb-10 flex flex-wrap items-center gap-3 text-sm text-ink-500">
        Force a device tier:
        {TIERS.map((t) => (
          <a
            key={t}
            href={`?tier=${t}`}
            className="inline-flex min-h-11 items-center text-pink-600 underline-offset-2 hover:underline"
          >
            {t}
          </a>
        ))}
      </p>

      <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)_240px]">
        <aside aria-label="Sponsored 3D ad" className="hidden lg:block">
          <SidebarAd3D variant="rail" ads={left} className="sticky top-6" />
        </aside>
        <div className="flex min-w-0 flex-col gap-10">
          {SECTIONS.map((title, i) => (
            <div key={title} className="flex flex-col gap-10">
              <section aria-labelledby={`section-${i}`}>
                <h2 id={`section-${i}`} className="mb-4 font-display text-2xl text-ink-900">
                  {i + 1} · {title}
                </h2>
                <div className="h-56 rounded-card bg-blush-50" />
              </section>
              {i === 0 ? <SidebarAd3D variant="inline" ads={left} className="lg:hidden" /> : null}
              {i === 1 ? (
                <SidebarAdVideo variant="inline" ads={right} className="lg:hidden" />
              ) : null}
            </div>
          ))}
        </div>
        <aside aria-label="Sponsored video ad" className="hidden lg:block">
          <SidebarAdVideo variant="rail" ads={right} className="sticky top-6" />
        </aside>
      </div>

      <section aria-labelledby="variants-title" className="mt-20">
        <SectionHeading
          as="h2"
          title={<span id="variants-title">Every variant</span>}
          description="Both variants of each slot at any width, and the house card an empty slot shows."
        />
        <div className="flex flex-col gap-10">
          <Variants rail={<SidebarAd3D variant="rail" ads={left} />}>
            <SidebarAd3D variant="inline" ads={left} />
          </Variants>
          <Variants rail={<SidebarAdVideo variant="rail" ads={right} />}>
            <SidebarAdVideo variant="inline" ads={right} />
          </Variants>
          <Variants rail={<SidebarAdVideo variant="rail" ads={[]} />}>
            <HouseAd variant="inline" />
          </Variants>
        </div>
      </section>
    </Container>
  );
}

function Variants({ rail, children }: { rail: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-6 md:flex-row">
      {rail}
      <div className="w-full min-w-0 md:flex-1">{children}</div>
    </div>
  );
}

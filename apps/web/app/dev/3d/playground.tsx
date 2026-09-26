'use client';

import type { ModelKind } from '@hb/three/3d';
import { useDeviceTier } from '@hb/three';
import { Badge, Container, SectionHeading, ShadePicker, type Shade } from '@hb/ui';
import dynamic from 'next/dynamic';
import { useState } from 'react';

const ProductViewer = dynamic(() => import('@hb/three/3d').then((m) => m.ProductViewer), {
  ssr: false,
  loading: () => <div className="aspect-square w-full animate-skeleton rounded-card bg-pink-100" />,
});

const KINDS: { kind: ModelKind; label: string; poster: string }[] = [
  { kind: 'lipstick', label: 'Lipstick', poster: '/placeholders/lipstick-1.svg' },
  { kind: 'compact', label: 'Compact', poster: '/placeholders/compact-1.svg' },
  { kind: 'perfume', label: 'Perfume', poster: '/placeholders/perfume-1.svg' },
  { kind: 'jar', label: 'Cream jar', poster: '/placeholders/jar-1.svg' },
];

// Shade swatches are product data (hex from the catalog), not UI colours.
const SHADES: Shade[] = [
  { name: 'Ruby Rose', hex: '#C2185B' },
  { name: 'Blush Nude', hex: '#D98E8E' },
  { name: 'Berry Night', hex: '#7B1E45' },
  { name: 'Coral Kiss', hex: '#F0625D' },
  { name: 'Mauve Silk', hex: '#A8667E' },
];

const TIERS = ['high', 'mid', 'low'] as const;

export function Playground() {
  const tier = useDeviceTier();
  const [kind, setKind] = useState<ModelKind>('lipstick');
  const [shade, setShade] = useState(SHADES[0]?.name ?? '');
  const [lid, setLid] = useState(0.8);
  const [particles, setParticles] = useState(true);
  const [spin, setSpin] = useState(true);
  const current = KINDS.find((k) => k.kind === kind) ?? KINDS[0]!;
  const hex = SHADES.find((s) => s.name === shade)?.hex ?? '#C2185B';

  return (
    <Container className="py-10">
      <SectionHeading eyebrow="Internal" title="3D playground" />
      <div className="mt-8 grid gap-8 md:grid-cols-[minmax(0,1fr)_320px]">
        <ProductViewer
          name={`${current.label} in ${shade}`}
          kind={kind}
          shadeHex={hex}
          posterSrc={current.poster}
          lidOpen={lid}
          particles={particles}
          autoRotate={spin}
          className="aspect-square w-full"
        />
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-sm">
            Tier: <Badge kind="threeD">{tier ?? 'detecting…'}</Badge>
            {TIERS.map((t) => (
              <a
                key={t}
                href={`?tier=${t}`}
                className="text-pink-600 underline-offset-2 hover:underline"
              >
                {t}
              </a>
            ))}
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Model</legend>
            <div className="flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <button
                  key={k.kind}
                  type="button"
                  aria-pressed={k.kind === kind}
                  onClick={() => setKind(k.kind)}
                  className="rounded-pill border border-ink-200 px-4 py-2 text-sm aria-pressed:border-gold-500 aria-pressed:bg-blush-50 aria-pressed:text-pink-700"
                >
                  {k.label}
                </button>
              ))}
            </div>
          </fieldset>
          <ShadePicker shades={SHADES} value={shade} onChange={setShade} />
          <label className="block text-sm font-medium">
            {kind === 'lipstick' ? 'Twist up' : 'Lid open'}
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={lid}
              onChange={(e) => setLid(Number(e.target.value))}
              className="mt-2 block w-full accent-pink-600"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={particles}
              onChange={(e) => setParticles(e.target.checked)}
              className="accent-pink-600"
            />
            Petals and gold dust
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={spin}
              onChange={(e) => setSpin(e.target.checked)}
              className="accent-pink-600"
            />
            Auto-rotate
          </label>
        </div>
      </div>
    </Container>
  );
}

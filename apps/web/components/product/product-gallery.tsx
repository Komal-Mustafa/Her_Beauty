'use client';

import type { ModelKind } from '@hb/three/3d';
import {
  Badge,
  prefersReducedMotion,
  Skeleton,
  Tabs,
  usePrefersReducedMotion,
  type TabItem,
} from '@hb/ui';
import { DURATION, EASE_SOFT_CSS } from '@hb/ui/motion';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { GalleryImages } from './gallery-images';
import { galleryImages, galleryModel, galleryVideo } from './gallery-media';
import { useProduct } from './product-context';

// three.js + R3F stay out of first-load JS: this chunk loads the first time the 3D tab opens.
const ProductViewer = dynamic(() => import('@hb/three/3d').then((m) => m.ProductViewer), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-card" />,
});

type TabId = 'images' | 'video' | '3d';
const ORDER: readonly TabId[] = ['images', 'video', '3d'];

/** Distance the incoming panel slides (px), from the side of the tab that was picked. */
const SLIDE = 12;

/**
 * Product gallery (docs/p5-catalog.md §5): Images | Video | 3D tabs, only for media the product
 * has (no tab list at all for images only). The video never autoplays. The 3D viewer mounts the
 * first time its tab opens and follows the chosen shade live. A tab change slides the panel 12 px
 * and fades it in (opacity only under reduced motion).
 */
export function ProductGallery() {
  const { product, shadeHex, galleryImageRef } = useProduct();
  const reduced = usePrefersReducedMotion();
  const images = galleryImages(product);
  const video = galleryVideo(product);
  const model = galleryModel(product);

  const [tab, setTab] = useState<TabId>('images');
  const [opened3d, setOpened3d] = useState(false);
  const panels = useRef(new Map<TabId, HTMLDivElement>());
  const videoRef = useRef<HTMLVideoElement>(null);
  /** Set by a tab change: +1 slides in from the right (a tab further right was picked), -1 left. */
  const slide = useRef(0);

  function onTab(id: string) {
    const next = id as TabId;
    const order = ORDER.filter((t) => t === next || t === tab);
    slide.current = next === tab ? 0 : order[0] === tab ? 1 : -1;
    setTab(next);
    if (next === '3d') setOpened3d(true);
  }

  // Slide the newly shown panel in; pause a video that is no longer on screen.
  useEffect(() => {
    if (tab !== 'video') videoRef.current?.pause();
    const dir = slide.current;
    slide.current = 0;
    const el = panels.current.get(tab);
    if (!dir || !el || typeof el.animate !== 'function') return;
    el.animate(
      prefersReducedMotion()
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: `translateX(${dir * SLIDE}px)` },
            { opacity: 1, transform: 'translateX(0)' },
          ],
      { duration: DURATION.base * 1000, easing: EASE_SOFT_CSS },
    );
  }, [tab]);

  const imagesPanel = <GalleryImages images={images} activeRef={galleryImageRef} />;
  if (!video && !model) return imagesPanel;

  const panel = (id: TabId, content: ReactNode) => (
    <div
      ref={(el) => {
        if (el) panels.current.set(id, el);
        else panels.current.delete(id);
      }}
    >
      {content}
    </div>
  );

  const items: TabItem[] = [
    { id: 'images', label: 'Images', content: panel('images', imagesPanel) },
  ];
  if (video) {
    items.push({
      id: 'video',
      label: 'Video',
      content: panel(
        'video',
        <video
          ref={videoRef}
          src={video.url}
          poster={video.posterUrl ?? images[0]?.url}
          controls
          muted
          playsInline
          preload="none"
          aria-label={video.alt}
          className="aspect-[4/5] w-full rounded-card bg-blush-50 object-contain"
        />,
      ),
    });
  }
  if (model) {
    const kind: ModelKind = model.model3dKind ?? 'jar';
    items.push({
      id: '3d',
      label: <Badge kind="threeD" className="px-2" />,
      content: panel(
        '3d',
        <div className="aspect-[4/5] w-full">
          {opened3d ? (
            <ProductViewer
              name={product.title}
              kind={kind}
              shadeHex={shadeHex}
              posterSrc={model.posterUrl ?? images[0]?.url ?? product.images[0]?.url ?? ''}
              src={model.url || null}
              autoRotate={!reduced}
              className="h-full w-full"
            />
          ) : null}
        </div>,
      ),
    });
  }

  return <Tabs label="Product media" items={items} onValueChange={onTab} />;
}

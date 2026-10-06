// @vitest-environment jsdom
import type { Product } from '@hb/types';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentType, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lipOil, lipstick } from './test-product';

type ViewerProps = { shadeHex: string; kind: string; autoRotate?: boolean; src?: string | null };

// The WebGL viewer is replaced by a stand-in that records what it was given.
const viewer = vi.hoisted(() => ({ renders: [] as ViewerProps[] }));
vi.mock('@hb/three/3d', () => ({
  ProductViewer: (props: ViewerProps) => {
    viewer.renders.push(props);
    return <div data-testid="viewer" data-shade={props.shadeHex} data-kind={props.kind} />;
  },
}));
// next/dynamic as React.lazy: the loader still runs only when the component first renders.
vi.mock('next/dynamic', async () => {
  const { createElement, lazy, Suspense } = await import('react');
  return {
    default: (load: () => Promise<ComponentType<object>>, opts?: { loading?: () => ReactNode }) => {
      const Lazy = lazy(async () => ({ default: await load() }));
      return (props: object) =>
        createElement(
          Suspense,
          { fallback: opts?.loading?.() ?? null },
          createElement(Lazy, props),
        );
    },
  };
});
const fly = vi.hoisted(() => vi.fn());
vi.mock('@/lib/fly-to-cart', () => ({ flyToCart: fly }));

let reduced = false;
/** Whether the window is 1024 px or wider. */
let desktop = false;
const animate = vi.fn();
const scrollTo = vi.fn();

async function renderGallery(product: Product = lipstick()) {
  vi.resetModules();
  const [{ ToastProvider }, { ProductProvider }, { ProductGallery }, { BuyBox }] =
    await Promise.all([
      import('@hb/ui'),
      import('./product-context'),
      import('./product-gallery'),
      import('./buy-box'),
    ]);
  render(
    <ToastProvider>
      <ProductProvider product={product} initialVariantId={product.variants[0]!.id}>
        <section aria-label="Gallery">
          <ProductGallery />
        </section>
        <BuyBox />
      </ProductProvider>
    </ToastProvider>,
  );
}

const gallery = () => within(screen.getByRole('region', { name: 'Gallery' }));
const tab = (name: string) => gallery().getByRole('tab', { name });

beforeEach(() => {
  reduced = false;
  desktop = false;
  viewer.renders.length = 0;
  fly.mockClear();
  animate.mockClear();
  window.localStorage.clear();
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion')
      ? reduced
      : query.includes('min-width: 64rem')
        ? desktop
        : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
  HTMLElement.prototype.animate = animate as unknown as HTMLElement['animate'];
  // jsdom has no layout, so no Element.scrollTo either.
  HTMLElement.prototype.scrollTo = scrollTo as unknown as HTMLElement['scrollTo'];
  scrollTo.mockClear();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
  delete (HTMLElement.prototype as Partial<HTMLElement>).scrollTo;
});

describe('ProductGallery', () => {
  it('shows only images, with no tabs, when the product has nothing else', async () => {
    await renderGallery(lipOil());
    expect(gallery().queryByRole('tablist')).toBeNull();
    expect(gallery().getByRole('img', { name: 'Silk Lip Oil' })).toBeTruthy();
    // One image: no dots and no thumbnails.
    expect(gallery().queryByRole('button')).toBeNull();
  });

  it('has a tab for each kind of media, the 3D one with its gold chip', async () => {
    await renderGallery();
    const list = gallery().getByRole('tablist', { name: 'Product media' });
    expect(
      within(list)
        .getAllByRole('tab')
        .map((t) => t.textContent),
    ).toEqual(['Images', 'Video', '3D']);
    expect(tab('Images').getAttribute('aria-selected')).toBe('true');
  });

  it('leaves out the tabs a product has no media for', async () => {
    const product = lipstick();
    await renderGallery({ ...product, media: product.media.filter((m) => m.type !== 'video') });
    expect(
      gallery()
        .getAllByRole('tab')
        .map((t) => t.textContent),
    ).toEqual(['Images', '3D']);
  });

  it('never autoplays the video and pauses it when its tab is left', async () => {
    await renderGallery();
    fireEvent.click(tab('Video'));
    const video = gallery().getByLabelText('Velvet Matte Lipstick video') as HTMLVideoElement;
    expect(video.controls).toBe(true);
    expect(video.muted).toBe(true);
    expect(video.autoplay).toBe(false);
    expect(video.getAttribute('preload')).toBe('none');
    expect(video.hasAttribute('playsinline')).toBe(true);
    expect(video.getAttribute('poster')).toBe('/placeholders/lipstick-2.svg');

    const pause = vi.mocked(HTMLMediaElement.prototype.pause);
    pause.mockClear();
    fireEvent.click(tab('Images'));
    expect(pause).toHaveBeenCalled();
  });

  it('mounts the 3D viewer the first time its tab opens and keeps it', async () => {
    await renderGallery();
    expect(gallery().queryByTestId('viewer')).toBeNull();
    expect(viewer.renders).toHaveLength(0);

    fireEvent.click(tab('3D'));
    const view = await gallery().findByTestId('viewer');
    expect(view.dataset.kind).toBe('lipstick');
    expect(view.dataset.shade).toBe('#8E1B4F');
    expect(viewer.renders.at(-1)).toMatchObject({ autoRotate: true, src: null });

    fireEvent.click(tab('Images'));
    expect(gallery().getByTestId('viewer')).toBe(view);
  });

  it('re-tints the 3D model when a shade is picked', async () => {
    await renderGallery();
    fireEvent.click(tab('3D'));
    const view = await gallery().findByTestId('viewer');
    fireEvent.click(screen.getByRole('radio', { name: 'Rose Petal' }));
    expect(view.dataset.shade).toBe('#C2185B');
  });

  it('keeps the model still under reduced motion', async () => {
    reduced = true;
    await renderGallery();
    fireEvent.click(tab('3D'));
    await gallery().findByTestId('viewer');
    expect(viewer.renders.at(-1)?.autoRotate).toBe(false);
  });

  it('moves between tabs with the arrow keys, Home and End', async () => {
    await renderGallery();
    fireEvent.keyDown(tab('Images'), { key: 'ArrowRight' });
    expect(tab('Video').getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab('Video'));
    fireEvent.keyDown(tab('Video'), { key: 'End' });
    expect(tab('3D').getAttribute('aria-selected')).toBe('true');
    expect(await gallery().findByTestId('viewer')).toBeTruthy();
    fireEvent.keyDown(tab('3D'), { key: 'Home' });
    expect(tab('Images').getAttribute('aria-selected')).toBe('true');
  });

  it('slides the new panel in from the side of the picked tab', async () => {
    await renderGallery();
    fireEvent.click(tab('Video'));
    expect(animate).toHaveBeenLastCalledWith(
      [
        { opacity: 0, transform: 'translateX(12px)' },
        { opacity: 1, transform: 'translateX(0)' },
      ],
      expect.objectContaining({ duration: expect.any(Number) }),
    );
    fireEvent.click(tab('Images'));
    expect(animate.mock.lastCall?.[0]).toEqual([
      { opacity: 0, transform: 'translateX(-12px)' },
      { opacity: 1, transform: 'translateX(0)' },
    ]);
    animate.mockClear();
    fireEvent.click(tab('Images'));
    expect(animate).not.toHaveBeenCalled();
  });

  it('only fades the panel under reduced motion', async () => {
    reduced = true;
    await renderGallery();
    fireEvent.click(tab('Video'));
    expect(animate.mock.lastCall?.[0]).toEqual([{ opacity: 0 }, { opacity: 1 }]);
  });

  it('picks an image with the thumbnails and flies that image to the cart', async () => {
    await renderGallery();
    const thumbs = gallery()
      .getAllByRole('button')
      .filter((b) => b.hasAttribute('aria-pressed'));
    expect(thumbs.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    fireEvent.click(thumbs[1]!);
    expect(thumbs.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
    expect(
      gallery().getByRole('button', { name: 'Show image 2 of 2' }).getAttribute('aria-current'),
    ).toBe('true');
    // Below 1024 px the strip scrolls to the picked image.
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: 'smooth' });

    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    const [{ imageSrc, from }] = fly.mock.lastCall as [{ imageSrc: string; from: unknown[] }];
    expect(imageSrc).toContain('lipstick-2.svg');
    expect((from[0] as HTMLImageElement).alt).toBe('Velvet Matte Lipstick, open');
  });
});

describe('image strip (below 1024 px)', () => {
  it('is a named list and a Tab stop while it scrolls', async () => {
    await renderGallery();
    const strip = gallery().getByRole('list', { name: 'Product images' });
    expect(strip.tabIndex).toBe(0);
  });

  it('is no Tab stop from 1024 px, where it shows one image', async () => {
    desktop = true;
    await renderGallery();
    const strip = gallery().getByRole('list', { name: 'Product images' });
    expect(strip.hasAttribute('tabindex')).toBe(false);
  });

  it('is no Tab stop with a single image, which does not scroll', async () => {
    await renderGallery(lipOil());
    const strip = gallery().getByRole('list', { name: 'Product images' });
    expect(strip.hasAttribute('tabindex')).toBe(false);
  });
});

describe('gallery helpers', () => {
  it('falls back to the product images when the media list has none', async () => {
    const { galleryImages } = await import('./product-gallery');
    const product = lipstick();
    expect(galleryImages({ ...product, media: [] }).map((i) => i.url)).toEqual([
      '/placeholders/lipstick-1.svg',
      '/placeholders/lipstick-2.svg',
    ]);
  });

  it('finds a 3D item only when it has a model kind or a file', async () => {
    const { galleryModel } = await import('./product-gallery');
    const product = lipstick();
    const bare = product.media.map((m) =>
      m.type === 'model3d' ? { ...m, model3dKind: null, url: '' } : m,
    );
    expect(galleryModel({ ...product, media: bare })).toBeNull();
    const file = product.media.map((m) =>
      m.type === 'model3d' ? { ...m, model3dKind: null, url: '/models/lipstick.glb' } : m,
    );
    expect(galleryModel({ ...product, media: file })?.url).toBe('/models/lipstick.glb');
  });
});

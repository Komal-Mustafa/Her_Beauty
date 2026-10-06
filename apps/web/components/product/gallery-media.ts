import type { Product } from '@hb/types';
import type { GalleryImage } from './gallery-images';

/*
 * What the product gallery shows (docs/p5-catalog.md §5 "Gallery tabs"). Plain functions, not in
 * the client gallery module, so the server (the route's layout, for its skeleton) can call them.
 */

export function galleryImages(product: Product): GalleryImage[] {
  const media = product.media.filter((m) => m.type === 'image' && m.url);
  if (media.length) return media.map((m) => ({ id: m.id, url: m.url, alt: m.alt }));
  return product.images.map((a, i) => ({ id: `image-${i}`, url: a.url, alt: a.alt }));
}

/** The 3D item: a procedural kind or a model file. */
export function galleryModel(product: Product) {
  return product.media.find((m) => m.type === 'model3d' && (m.model3dKind || m.url)) ?? null;
}

export function galleryVideo(product: Product) {
  return product.media.find((m) => m.type === 'video' && m.url) ?? null;
}

/** The gallery has a tab list (Images | Video | 3D) only when there is more than images. */
export function hasGalleryTabs(product: Product): boolean {
  return Boolean(galleryVideo(product) || galleryModel(product));
}

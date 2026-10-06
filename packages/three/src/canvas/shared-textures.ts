import type { Material, Object3D, Texture } from 'three';

/** What this needs of a WebGLRenderer: its per-object bookkeeping. */
export type RendererProperties = {
  properties: { has: (object: unknown) => boolean; get: (object: unknown) => unknown };
};

type MaterialProperties = { uniforms?: { dfgLUT?: { value?: unknown } } };

function isTexture(value: unknown): value is Texture {
  return typeof value === 'object' && value !== null && (value as Texture).isTexture === true;
}

/**
 * The DFG lookup texture three (r186) shares between every renderer: one module-level texture
 * (`getDFGLUT`), handed to each standard and physical material as its `dfgLUT` uniform. Each
 * renderer that uploads it adds a `dispose` listener to it, and that listener holds the renderer,
 * its GL context and its canvas, so an unmounted canvas (and the page around it) stays in memory
 * for good: `renderer.dispose()` and context loss never remove it, only `texture.dispose()` does.
 *
 * Returns the texture once a material using it has been drawn by this renderer, else null. Only
 * reads what the renderer already keeps (no entry is created for a material it has not seen).
 */
export function findSharedLut(renderer: RendererProperties, scene: Object3D): Texture | null {
  let found: Texture | null = null;
  scene.traverse((object) => {
    if (found) return;
    const material = (object as Object3D & { material?: Material | Material[] }).material;
    const materials = Array.isArray(material) ? material : material ? [material] : [];
    for (const m of materials) {
      if (!renderer.properties.has(m)) continue;
      const value = (renderer.properties.get(m) as MaterialProperties).uniforms?.dfgLUT?.value;
      if (isTexture(value)) {
        found = value;
        return;
      }
    }
  });
  return found;
}

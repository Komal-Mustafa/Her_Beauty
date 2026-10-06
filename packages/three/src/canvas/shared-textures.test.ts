import {
  DataTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Scene,
  SphereGeometry,
} from 'three';
import { describe, expect, it } from 'vitest';
import { findSharedLut, type RendererProperties } from './shared-textures';

/** A renderer's bookkeeping: what it stored for each object it has drawn. */
function renderer(entries: [object, unknown][]): RendererProperties & { created: unknown[] } {
  const map = new Map<unknown, unknown>(entries);
  const created: unknown[] = [];
  return {
    created,
    properties: {
      has: (object) => map.has(object),
      get: (object) => {
        if (!map.has(object)) {
          created.push(object);
          map.set(object, {});
        }
        return map.get(object);
      },
    },
  };
}

const lut = new DataTexture(new Uint16Array(16 * 16 * 2), 16, 16);

describe('findSharedLut', () => {
  it('finds the texture a drawn standard material uses, deep in the scene', () => {
    const material = new MeshStandardMaterial();
    const scene = new Scene();
    const group = new Group();
    group.add(new Mesh(new SphereGeometry(), material));
    scene.add(group);
    const r = renderer([[material, { uniforms: { dfgLUT: { value: lut } } }]]);
    expect(findSharedLut(r, scene)).toBe(lut);
  });

  it('looks through multi-material meshes', () => {
    const basic = new MeshBasicMaterial();
    const standard = new MeshStandardMaterial();
    const scene = new Scene().add(new Mesh(new SphereGeometry(), [basic, standard]));
    const r = renderer([
      [basic, { uniforms: {} }],
      [standard, { uniforms: { dfgLUT: { value: lut } } }],
    ]);
    expect(findSharedLut(r, scene)).toBe(lut);
  });

  it('is null until a material using it has been drawn, and adds nothing to the renderer', () => {
    const material = new MeshStandardMaterial();
    const scene = new Scene().add(new Mesh(new SphereGeometry(), material));
    const r = renderer([]);
    expect(findSharedLut(r, scene)).toBeNull();
    expect(r.created).toEqual([]);
    // Compiled but not drawn yet: the uniform is still empty.
    const compiled = renderer([[material, { uniforms: { dfgLUT: { value: null } } }]]);
    expect(findSharedLut(compiled, scene)).toBeNull();
  });
});

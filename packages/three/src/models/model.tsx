'use client';

import { useGLTF } from '@react-three/drei';
import { Component, Suspense, useMemo, type ReactNode } from 'react';
import { CreamJar } from './cream-jar';
import { Compact } from './compact';
import { Lipstick } from './lipstick';
import { Perfume } from './perfume';

export type ModelKind = 'lipstick' | 'compact' | 'perfume' | 'jar';

export type ModelProps = {
  kind: ModelKind;
  shadeHex: string;
  /** Optional .glb from the product's media (05 schema ProductMedia.model3d). Falls back to the procedural model. */
  src?: string | null;
  lidOpen?: number;
  transmission?: boolean;
};

class ModelBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Gltf({ src }: { src: string }) {
  const { scene } = useGLTF(src);
  const clone = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={clone} />;
}

export function ProceduralModel({
  kind,
  shadeHex,
  lidOpen,
  transmission,
}: Omit<ModelProps, 'src'>) {
  switch (kind) {
    case 'lipstick':
      return <Lipstick shadeHex={shadeHex} open={lidOpen ?? 1} />;
    case 'compact':
      return <Compact shadeHex={shadeHex} lidOpen={lidOpen ?? 0.8} />;
    case 'perfume':
      return <Perfume shadeHex={shadeHex} transmission={transmission} />;
    case 'jar':
      return <CreamJar shadeHex={shadeHex} />;
  }
}

/** Real .glb when provided (with the procedural model as loading + error fallback), else procedural. */
export function Model({ src, ...rest }: ModelProps) {
  const procedural = <ProceduralModel {...rest} />;
  if (!src) return procedural;
  return (
    <ModelBoundary fallback={procedural}>
      <Suspense fallback={procedural}>
        <Gltf src={src} />
      </Suspense>
    </ModelBoundary>
  );
}

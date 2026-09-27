'use client';

import type { ModelKind } from '@hb/three/3d';
import dynamic from 'next/dynamic';
import { useState } from 'react';

const AdModelStage = dynamic(() => import('@hb/three/3d').then((m) => m.AdModelStage), {
  ssr: false,
});

/**
 * The bare 3D ad stage, filling the viewport, for scripts/render-ad-loop.mjs to record the
 * placeholder video. `data-loop-ready` appears once the first frame is drawn.
 */
export function LoopStage({
  label,
  kind,
  shadeHex,
}: {
  label: string;
  kind: ModelKind;
  shadeHex: string;
}) {
  const [ready, setReady] = useState(false);
  return (
    <div data-loop-ready={ready ? 'true' : undefined} className="fixed inset-0">
      <AdModelStage
        label={label}
        kind={kind}
        shadeHex={shadeHex}
        tier="high"
        onReady={() => setReady(true)}
        className="h-full w-full"
      />
    </div>
  );
}

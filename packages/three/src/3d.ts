'use client';

// Heavy WebGL entry (three + R3F). Import this only via next/dynamic({ ssr: false }) so it stays
// out of the initial bundle; `@hb/three` itself only exposes the lightweight tier helpers.
export { TieredCanvas } from './canvas/tiered-canvas';
export { Model, ProceduralModel, type ModelKind, type ModelProps } from './models/model';
export { Lipstick } from './models/lipstick';
export { Compact } from './models/compact';
export { Perfume } from './models/perfume';
export { CreamJar } from './models/cream-jar';
export { Pedestal } from './models/pedestal';
export { Studio } from './scene/studio';
export { GoldDust, Petals } from './scene/particles';
export { ProductViewer, type ProductViewerProps } from './viewer/product-viewer';
export { AdModelStage, type AdModelStageProps } from './ads/ad-model-stage';
export { HeroScene, type HeroSceneProps, type HeroProduct } from './hero/hero-scene';

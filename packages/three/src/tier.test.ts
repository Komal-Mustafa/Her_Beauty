import { describe, expect, it } from 'vitest';
import { resolveTier, type TierSignals } from './tier';

const base: TierSignals = {
  gpuTier: 3,
  isMobile: false,
  reducedMotion: false,
  saveData: false,
  webgl: true,
};

describe('resolveTier', () => {
  it('gives high to strong desktop GPUs', () => expect(resolveTier(base)).toBe('high'));
  it('caps strong phones at mid', () =>
    expect(resolveTier({ ...base, isMobile: true })).toBe('mid'));
  it('drops weak GPUs to low', () => expect(resolveTier({ ...base, gpuTier: 1 })).toBe('low'));
  it('respects reduced motion', () =>
    expect(resolveTier({ ...base, reducedMotion: true })).toBe('low'));
  it('respects Save-Data', () => expect(resolveTier({ ...base, saveData: true })).toBe('low'));
  it('falls back without WebGL', () => expect(resolveTier({ ...base, webgl: false })).toBe('low'));
  it('treats unknown GPUs as mid', () =>
    expect(resolveTier({ ...base, gpuTier: null })).toBe('mid'));
});

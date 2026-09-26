import { describe, expect, it } from 'vitest';
import {
  CREAM_JAR_PROFILE,
  LIPSTICK_CASE_PROFILE,
  scatter,
  slantCylinderTop,
  slantTopY,
} from './geometry';

describe('slantTopY', () => {
  it('is full height at the back and drops by `cut` at the front', () => {
    expect(slantTopY(-0.2, 0.2, 1, 0.3)).toBeCloseTo(0.5);
    expect(slantTopY(0.2, 0.2, 1, 0.3)).toBeCloseTo(0.2);
    expect(slantTopY(0, 0.2, 1, 0.3)).toBeCloseTo(0.35);
  });

  it('clamps x outside the radius', () => {
    expect(slantTopY(5, 0.2, 1, 0.3)).toBeCloseTo(0.2);
  });
});

describe('slantCylinderTop', () => {
  it('keeps the bottom fixed and never lifts a vertex above the slanted top', () => {
    // three vertices at the front edge: bottom, middle, top
    const p = new Float32Array([0.2, -0.5, 0, 0.2, 0, 0, 0.2, 0.5, 0]);
    slantCylinderTop(p, 0.2, 1, 0.3);
    expect(p[1]).toBeCloseTo(-0.5);
    expect(p[7]).toBeCloseTo(0.2);
    expect(p[4]).toBeGreaterThan(p[1] ?? 0);
    expect(p[4]).toBeLessThan(p[7] ?? 0);
  });
});

describe('lathe profiles', () => {
  it('never go downward', () => {
    for (const profile of [LIPSTICK_CASE_PROFILE, CREAM_JAR_PROFILE]) {
      for (let i = 1; i < profile.length; i++) {
        expect(profile[i]?.[1]).toBeGreaterThanOrEqual(profile[i - 1]?.[1] ?? 0);
      }
    }
  });
});

describe('scatter', () => {
  it('is deterministic and stays inside the box', () => {
    const a = scatter(50, 7, [4, 2, 2]);
    expect(a).toEqual(scatter(50, 7, [4, 2, 2]));
    expect(a).toHaveLength(150);
    for (let i = 0; i < a.length; i += 3) {
      expect(Math.abs(a[i] ?? 0)).toBeLessThanOrEqual(2);
      expect(Math.abs(a[i + 1] ?? 0)).toBeLessThanOrEqual(1);
    }
  });
});

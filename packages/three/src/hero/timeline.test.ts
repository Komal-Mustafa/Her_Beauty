import { describe, expect, it } from 'vitest';
import { heroState, span } from './timeline';

describe('heroState', () => {
  it('opens on the logo with every product hidden', () => {
    const s = heroState(0);
    expect(s.scene).toBe(0);
    expect(s.duoScale).toBe(0);
    expect(s.orbitScale).toBe(0);
    expect(s.adScale).toBe(0);
  });

  it('shows the lipstick + compact at the end of scene 2', () => {
    const s = heroState(0.47);
    expect(s.scene).toBe(1);
    expect(s.duoScale).toBeCloseTo(1);
    expect(s.duoY).toBeCloseTo(0);
  });

  it('has the orbit in and the camera arced in scene 3', () => {
    const s = heroState(0.7);
    expect(s.scene).toBe(2);
    expect(s.orbitScale).toBeCloseTo(1);
    expect(s.duoScale).toBe(0);
    expect(s.camArc).toBeGreaterThan(0.3);
  });

  it('lands the featured ad product centred with the camera back square', () => {
    const s = heroState(1);
    expect(s.scene).toBe(3);
    expect(s.adScale).toBe(1);
    expect(s.adY).toBe(0);
    expect(s.orbitScale).toBe(0);
    expect(s.camArc).toBeCloseTo(0);
  });

  it('clamps out-of-range progress and only dollies in', () => {
    expect(heroState(-1)).toEqual(heroState(0));
    expect(heroState(2)).toEqual(heroState(1));
    let last = Infinity;
    for (let p = 0; p <= 1; p += 0.05) {
      const d = heroState(p).camDistance;
      expect(d).toBeLessThanOrEqual(last);
      last = d;
    }
  });
});

describe('span', () => {
  it('is 0 before, 1 after and 0.5 in the middle', () => {
    expect(span(0.1, 0.2, 0.4)).toBe(0);
    expect(span(0.5, 0.2, 0.4)).toBe(1);
    expect(span(0.3, 0.2, 0.4)).toBeCloseTo(0.5);
  });
});

import { describe, expect, it } from 'vitest';
import { MAX_TINT_STEP, startTint, stepTint, tintProgress, TINT_SECONDS, type Rgb } from './tint';

const RED: Rgb = { r: 1, g: 0, b: 0 };
const BLUE: Rgb = { r: 0, g: 0, b: 1 };
const FRAME = 1 / 60;

describe('shade tint', () => {
  it('runs 0 → 1 over TINT_SECONDS, fast at first and soft at the end', () => {
    expect(tintProgress(0)).toBe(0);
    expect(tintProgress(TINT_SECONDS)).toBe(1);
    expect(tintProgress(TINT_SECONDS * 2)).toBe(1);
    // damped: more than half the change in the first fifth of the time
    expect(tintProgress(TINT_SECONDS / 5)).toBeGreaterThan(0.5);
    let last = 0;
    for (let i = 1; i < Math.floor(TINT_SECONDS / FRAME); i++) {
      const p = tintProgress(i * FRAME);
      expect(p).toBeGreaterThan(last);
      expect(p).toBeLessThan(1);
      last = p;
    }
  });

  it('lands exactly on the target in about 450 ms of frames, then is done', () => {
    const tint = startTint(RED, BLUE);
    let frames = 0;
    let colour = stepTint(tint, FRAME);
    while (!tint.done) {
      colour = stepTint(tint, FRAME);
      frames++;
    }
    expect(colour).toEqual(BLUE);
    expect(frames).toBeGreaterThanOrEqual(Math.floor(TINT_SECONDS / FRAME) - 2);
    expect(frames).toBeLessThanOrEqual(Math.ceil(TINT_SECONDS / FRAME) + 1);
    expect(stepTint(tint, FRAME)).toEqual(BLUE);
  });

  it('never jumps: a long gap between frames counts as one short step', () => {
    const tint = startTint(RED, BLUE);
    const colour = stepTint(tint, 5);
    expect(tint.done).toBe(false);
    expect(tint.elapsed).toBe(MAX_TINT_STEP);
    expect(colour.b).toBeGreaterThan(0);
    expect(colour.b).toBeLessThan(1);
  });

  it('is instant under reduced motion', () => {
    const tint = startTint(RED, BLUE, true);
    expect(tint.done).toBe(true);
    expect(stepTint(tint, 0)).toEqual(BLUE);
  });

  it('copies its endpoints, so a live colour object can be passed in', () => {
    const live = { ...RED };
    const tint = startTint(live, BLUE);
    live.r = 0.2;
    expect(tint.from).toEqual(RED);
  });
});

import { describe, expect, it } from 'vitest';
import {
  bobOffset,
  createTurntable,
  dragTurntable,
  grabTurntable,
  KEY_STEP,
  MAX_FLICK,
  nudgeTurntable,
  releaseTurntable,
  RESUME_AFTER,
  SPIN_SPEED,
  stepTurntable,
  type Turntable,
} from './turntable';

const FRAME = 1 / 30;

function run(t: Turntable, seconds: number, spinning = true): Turntable {
  for (let i = 0; i < Math.round(seconds / FRAME); i += 1) stepTurntable(t, FRAME, spinning);
  return t;
}

describe('turntable', () => {
  it('turns exactly half a turn and two float cycles in 8 s (seamless video loop)', () => {
    const t = run(createTurntable(true), 8);
    expect(t.angle).toBeCloseTo(Math.PI, 6);
    expect(t.bob).toBeCloseTo(2, 6);
    expect(bobOffset(t)).toBeCloseTo(0, 6);
  });

  it('eases to a stop when paused and back up when resumed', () => {
    const t = run(createTurntable(true), 1);
    run(t, 3, false);
    expect(t.spin).toBe(0);
    const still = t.angle;
    run(t, 1, false);
    expect(t.angle).toBe(still);
    run(t, 3, true);
    expect(t.spin).toBeCloseTo(SPIN_SPEED, 3);
  });

  it('does not spin while paused from the start', () => {
    const t = run(createTurntable(false), 2, false);
    expect(t.angle).toBe(0);
  });

  it('follows a drag and holds still while grabbed', () => {
    const t = grabTurntable(createTurntable(true));
    dragTurntable(t, 50, 0.05);
    const held = t.angle;
    expect(held).toBeGreaterThan(0);
    run(t, 1);
    expect(t.angle).toBe(held);
  });

  it('glides after a flick, slows down, then resumes the auto-spin after a pause', () => {
    const t = grabTurntable(createTurntable(true));
    dragTurntable(t, 400, 0.016);
    expect(t.glide).toBe(MAX_FLICK);
    releaseTurntable(t, true);
    run(t, 2);
    expect(t.glide).toBe(0);
    expect(t.spin).toBe(0);
    run(t, RESUME_AFTER);
    expect(t.spin).toBeGreaterThan(SPIN_SPEED / 2);
  });

  it('drops the glide when the finger stopped before lifting', () => {
    const t = grabTurntable(createTurntable(true));
    dragTurntable(t, 40, 0.016);
    releaseTurntable(t, false);
    expect(t.glide).toBe(0);
  });

  it('steps one notch per arrow key and settles on it', () => {
    const t = createTurntable(true);
    nudgeTurntable(t, 1);
    nudgeTurntable(t, 1);
    nudgeTurntable(t, -1);
    run(t, 1);
    expect(t.target).toBeNull();
    expect(t.angle).toBeCloseTo(KEY_STEP, 3);
  });
});

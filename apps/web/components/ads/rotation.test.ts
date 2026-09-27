import { describe, expect, it } from 'vitest';
import {
  initialRotation,
  isPlaying,
  rotationReducer,
  shouldAnimate,
  shouldAutoRotate,
  type RotationAction,
  type RotationState,
} from './rotation';

const apply = (state: RotationState, ...actions: RotationAction[]) =>
  actions.reduce(rotationReducer, state);

/** Three ads, on screen, nobody interacting: the timer runs. */
const running = apply(initialRotation(3), { type: 'onScreen', value: true });

describe('ad rotation', () => {
  it('waits until the card has been seen', () => {
    expect(shouldAutoRotate(initialRotation(3))).toBe(false);
    expect(shouldAnimate(initialRotation(3))).toBe(false);
    expect(shouldAutoRotate(running)).toBe(true);
    expect(shouldAnimate(running)).toBe(true);
  });

  it('advances and wraps around', () => {
    const s = apply(running, { type: 'next' }, { type: 'next' });
    expect(s.index).toBe(2);
    expect(apply(s, { type: 'next' }).index).toBe(0);
  });

  it('jumps to a dot, wrapping out-of-range indexes', () => {
    expect(apply(running, { type: 'goTo', index: 1 }).index).toBe(1);
    expect(apply(running, { type: 'goTo', index: 4 }).index).toBe(1);
    expect(apply(running, { type: 'goTo', index: -1 }).index).toBe(2);
  });

  it('never rotates a single ad or an empty slot', () => {
    const one = apply(initialRotation(1), { type: 'onScreen', value: true });
    expect(shouldAutoRotate(one)).toBe(false);
    expect(apply(one, { type: 'next' }).index).toBe(0);
    const none = apply(initialRotation(0), { type: 'onScreen', value: true }, { type: 'next' });
    expect(none.index).toBe(0);
    expect(shouldAutoRotate(none)).toBe(false);
  });

  it.each<[string, RotationAction]>([
    ['hovered', { type: 'hover', value: true }],
    ['focused', { type: 'focus', value: true }],
    ['off screen', { type: 'onScreen', value: false }],
    ['in a hidden tab', { type: 'pageVisible', value: false }],
    ['paused by the shopper', { type: 'togglePlay' }],
    ['under reduced motion', { type: 'reducedMotion', value: true }],
  ])('pauses rotation while %s', (_, action) => {
    expect(shouldAutoRotate(apply(running, action))).toBe(false);
  });

  it('resumes when the pointer and focus leave', () => {
    const s = apply(
      running,
      { type: 'hover', value: true },
      { type: 'focus', value: true },
      { type: 'hover', value: false },
      { type: 'focus', value: false },
    );
    expect(shouldAutoRotate(s)).toBe(true);
  });

  it('keeps hover from stopping the media, but Pause stops both', () => {
    const hovered = apply(running, { type: 'hover', value: true });
    expect(shouldAnimate(hovered)).toBe(true);
    const paused = apply(running, { type: 'togglePlay' });
    expect(isPlaying(paused)).toBe(false);
    expect(shouldAnimate(paused)).toBe(false);
    const resumed = apply(paused, { type: 'togglePlay' });
    expect(shouldAnimate(resumed)).toBe(true);
    expect(shouldAutoRotate(resumed)).toBe(true);
  });

  it('under reduced motion shows stills until the shopper presses Play, and never auto-rotates', () => {
    const reduced = apply(running, { type: 'reducedMotion', value: true });
    expect(isPlaying(reduced)).toBe(false);
    expect(shouldAnimate(reduced)).toBe(false);
    const played = apply(reduced, { type: 'togglePlay' });
    expect(played.play).toBe('playing');
    expect(shouldAnimate(played)).toBe(true);
    expect(shouldAutoRotate(played)).toBe(false);
  });

  it('stops media in a hidden tab even when playing', () => {
    expect(shouldAnimate(apply(running, { type: 'pageVisible', value: false }))).toBe(false);
  });

  it('keeps the index valid when the number of ads changes', () => {
    const s = apply(running, { type: 'goTo', index: 2 }, { type: 'count', count: 2 });
    expect(s.index).toBe(0);
    expect(apply(running, { type: 'goTo', index: 1 }, { type: 'count', count: 2 }).index).toBe(1);
  });

  it('shows Play when autoplay is refused but keeps rotating the other ads', () => {
    const blocked = apply(running, { type: 'mediaBlocked' });
    expect(isPlaying(blocked)).toBe(false);
    expect(shouldAnimate(blocked)).toBe(false);
    expect(shouldAutoRotate(blocked)).toBe(true);
    // Rotation moves on without retrying the video until the shopper asks for it.
    expect(shouldAnimate(apply(blocked, { type: 'next' }))).toBe(false);
  });

  it('retries a blocked video when the shopper presses Play', () => {
    const played = apply(running, { type: 'mediaBlocked' }, { type: 'togglePlay' });
    expect(played.mediaBlocked).toBe(false);
    expect(played.play).toBe('playing');
    expect(shouldAnimate(played)).toBe(true);
    expect(shouldAutoRotate(played)).toBe(true);
  });
});

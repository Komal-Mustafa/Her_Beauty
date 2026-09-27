/**
 * Sidebar ad rotation (docs/p4-home.md §3), kept free of React and the DOM so it is unit-tested.
 * `useAdRotation` feeds it browser signals (hover, focus, viewport, tab, reduced motion).
 */

/** A slot with several ads crossfades to the next one this often. */
export const ROTATE_EVERY_MS = 8000;

/**
 * auto = play unless the shopper prefers reduced motion; paused / playing = they pressed the
 * Pause / Play button, which wins over the preference for the media (never for auto-rotation).
 */
export type PlayMode = 'auto' | 'paused' | 'playing';

export type RotationState = {
  index: number;
  count: number;
  hovered: boolean;
  focused: boolean;
  onScreen: boolean;
  pageVisible: boolean;
  reducedMotion: boolean;
  play: PlayMode;
};

export type RotationAction =
  | { type: 'next' }
  | { type: 'goTo'; index: number }
  | { type: 'count'; count: number }
  | { type: 'hover'; value: boolean }
  | { type: 'focus'; value: boolean }
  | { type: 'onScreen'; value: boolean }
  | { type: 'pageVisible'; value: boolean }
  | { type: 'reducedMotion'; value: boolean }
  | { type: 'togglePlay' }
  | { type: 'setPlay'; play: PlayMode };

export function initialRotation(count: number): RotationState {
  return {
    index: 0,
    count: Math.max(0, count),
    hovered: false,
    focused: false,
    // Unknown until the IntersectionObserver reports, so nothing starts before it is seen.
    onScreen: false,
    pageVisible: true,
    reducedMotion: false,
    play: 'auto',
  };
}

function wrap(index: number, count: number): number {
  return count > 0 ? ((index % count) + count) % count : 0;
}

export function rotationReducer(state: RotationState, action: RotationAction): RotationState {
  switch (action.type) {
    case 'next':
      return { ...state, index: wrap(state.index + 1, state.count) };
    case 'goTo':
      return { ...state, index: wrap(action.index, state.count) };
    case 'count': {
      const count = Math.max(0, action.count);
      return { ...state, count, index: state.index < count ? state.index : 0 };
    }
    case 'hover':
      return { ...state, hovered: action.value };
    case 'focus':
      return { ...state, focused: action.value };
    case 'onScreen':
      return { ...state, onScreen: action.value };
    case 'pageVisible':
      return { ...state, pageVisible: action.value };
    case 'reducedMotion':
      return { ...state, reducedMotion: action.value };
    case 'togglePlay':
      return { ...state, play: isPlaying(state) ? 'paused' : 'playing' };
    case 'setPlay':
      return { ...state, play: action.play };
  }
}

/** The shopper has not paused (reduced motion counts as paused until they press Play). */
export function isPlaying(s: RotationState): boolean {
  return s.play === 'playing' || (s.play === 'auto' && !s.reducedMotion);
}

/** Video / 3D spin should run now: playing, and the card is on screen in a visible tab. */
export function shouldAnimate(s: RotationState): boolean {
  return isPlaying(s) && s.onScreen && s.pageVisible;
}

/**
 * The 8 s timer should run: several ads, no reduced motion (dots only then), not paused, not
 * hovered or focused (the shopper is reading or using it), on screen, tab visible.
 */
export function shouldAutoRotate(s: RotationState): boolean {
  return (
    s.count > 1 &&
    !s.reducedMotion &&
    s.play !== 'paused' &&
    !s.hovered &&
    !s.focused &&
    s.onScreen &&
    s.pageVisible
  );
}

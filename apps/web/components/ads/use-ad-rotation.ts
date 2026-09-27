'use client';

import { useEffect, useMemo, useReducer, useRef, type FocusEvent } from 'react';
import {
  initialRotation,
  isPlaying,
  ROTATE_EVERY_MS,
  rotationReducer,
  shouldAnimate,
  shouldAutoRotate,
} from './rotation';

/**
 * Crossfade rotation for a sidebar ad slot (docs/p4-home.md §3). Spread `bind` on the card root:
 * it observes hover, focus and the viewport there. Returns the active index plus whether the
 * card's media (video, 3D spin) should be moving right now.
 */
export function useAdRotation(count: number) {
  const [state, dispatch] = useReducer(rotationReducer, count, initialRotation);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => dispatch({ type: 'count', count }), [count]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => dispatch({ type: 'reducedMotion', value: query.matches });
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const update = () =>
      dispatch({ type: 'pageVisible', value: document.visibilityState === 'visible' });
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  // A card hidden with display:none (the other breakpoint's copy) never intersects, so its
  // video never plays and its timer never runs.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) =>
      dispatch({ type: 'onScreen', value: Boolean(entry?.isIntersecting) }),
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const autoRotate = shouldAutoRotate(state);
  // Keyed on the index too, so choosing a dot restarts the full 8 s.
  useEffect(() => {
    if (!autoRotate) return;
    const timer = window.setTimeout(() => dispatch({ type: 'next' }), ROTATE_EVERY_MS);
    return () => window.clearTimeout(timer);
  }, [autoRotate, state.index]);

  // Stable identities: media effects depend on these callbacks.
  const actions = useMemo(
    () => ({
      goTo: (index: number) => dispatch({ type: 'goTo', index }),
      togglePlay: () => dispatch({ type: 'togglePlay' }),
      /** The media could not start by itself (e.g. autoplay blocked): show Play. */
      markPaused: () => dispatch({ type: 'setPlay', play: 'paused' }),
      bind: {
        ref,
        onPointerEnter: () => dispatch({ type: 'hover', value: true }),
        onPointerLeave: () => dispatch({ type: 'hover', value: false }),
        onFocus: () => dispatch({ type: 'focus', value: true }),
        onBlur: (e: FocusEvent<HTMLElement>) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            dispatch({ type: 'focus', value: false });
          }
        },
      },
    }),
    [],
  );

  return {
    ...actions,
    index: state.index,
    count: state.count,
    reducedMotion: state.reducedMotion,
    onScreen: state.onScreen,
    /** Not paused by the shopper (reduced motion counts as paused until they press Play). */
    playing: isPlaying(state),
    /** Media should be moving now: playing, on screen, tab visible. */
    animate: shouldAnimate(state),
  };
}

export type AdRotation = ReturnType<typeof useAdRotation>;

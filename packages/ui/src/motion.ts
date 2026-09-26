/** Motion tokens — docs/04-ui-ux-design.md §7. Use these instead of ad-hoc numbers. */
export const EASE_SOFT = [0.22, 1, 0.36, 1] as const;
export const EASE_SOFT_CSS = 'cubic-bezier(0.22, 1, 0.36, 1)';

export const DURATION = {
  fast: 0.15,
  base: 0.25,
  slow: 0.45,
  cinema: 1.0,
} as const;

/** Stagger between text lines / cards on reveal (seconds). */
export const STAGGER = 0.08;

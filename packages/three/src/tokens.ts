/**
 * 3D material tokens — docs/04-ui-ux-design.md §8 ("3D look").
 * Mirrors the Tailwind tokens in @hb/config so 3D and 2D stay one palette.
 */
export const COLORS_3D = {
  gold: '#D4AF37',
  goldDeep: '#B8872E',
  pink: '#C2185B',
  pinkSoft: '#F8BBD9',
  pinkMist: '#FCE4EF',
  blush: '#FFF5F9',
  marble: '#FBF7F5',
  night: '#1E0F16',
} as const;

export const GOLD_MATERIAL = {
  color: COLORS_3D.gold,
  metalness: 1,
  roughness: 0.25,
  clearcoat: 1,
  clearcoatRoughness: 0.15,
} as const;

export const LIPSTICK_MATERIAL = { roughness: 0.45, metalness: 0, clearcoat: 0.4 } as const;

export const DEFAULT_SHADE = COLORS_3D.pink;

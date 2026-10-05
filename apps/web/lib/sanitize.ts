import 'server-only';
import DOMPurify, { clearWindow, type Config } from 'isomorphic-dompurify';

/*
 * Seller-written rich text (docs/p5-catalog.md §7, security.md §XSS). Sanitized on the server at
 * render time, so no sanitizer (and no jsdom) ever reaches the browser: only these tags survive and
 * no attribute at all, so there is no `on*`, `style`, link or `javascript:` left to abuse. The
 * content of a removed tag is kept as text, except for script, style, iframe and the like, whose
 * content DOMPurify drops with them.
 */

/** The only tags a product description keeps. */
export const DESCRIPTION_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'b',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'h3',
  'h4',
  'blockquote',
] as const;

const CONFIG = {
  ALLOWED_TAGS: [...DESCRIPTION_TAGS],
  ALLOWED_ATTR: [],
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
  KEEP_CONTENT: true,
} satisfies Config;

/** Elements whose end separates words: they become a space in plain text. */
const BREAKS = 'p, br, li, h3, h4, blockquote';

/**
 * The server-side DOMPurify keeps one jsdom window, which grows a little with every call; a fresh
 * one now and then keeps a long-running server flat (isomorphic-dompurify README, "Memory").
 */
const CALLS_PER_WINDOW = 500;
let calls = 0;

function purify(): void {
  calls += 1;
  if (calls >= CALLS_PER_WINDOW) {
    calls = 0;
    clearWindow();
  }
}

/** Safe HTML for `dangerouslySetInnerHTML`: allowed tags only, no attributes. */
export function sanitizeDescription(html: string): string {
  purify();
  return DOMPurify.sanitize(html, CONFIG);
}

/** The description as one line of plain text (meta description, JSON-LD). */
export function descriptionText(html: string): string {
  purify();
  // RETURN_DOM hands back the <body> holding the clean nodes (typed as a plain Node).
  const body = DOMPurify.sanitize(html, { ...CONFIG, RETURN_DOM: true }) as Element;
  // Two paragraphs or list items must not run their words together.
  body.querySelectorAll(BREAKS).forEach((el) => el.after(' '));
  return (body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Cuts `text` to at most `max` characters at a word boundary, with an ellipsis when cut. */
export function excerpt(text: string, max = 160): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  // A single very long word is cut mid-word rather than dropped.
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s.,;:!?-]+$/, '')}…`;
}

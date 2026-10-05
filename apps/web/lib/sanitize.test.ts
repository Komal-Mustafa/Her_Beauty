import { describe, expect, it } from 'vitest';
import { descriptionText, excerpt, sanitizeDescription } from './sanitize';

describe('sanitizeDescription', () => {
  it('keeps the allowed formatting', () => {
    const html =
      '<p>Soft <strong>matte</strong> <em>finish</em>.</p><ul><li>Long-wear</li><li>Vegan</li></ul>' +
      '<h3>Why</h3><blockquote>Loved it</blockquote><ol><li><b>b</b><i>i</i><u>u</u><br></li></ol>';
    expect(sanitizeDescription(html)).toBe(html);
  });

  it.each([
    ['script tags and their content', '<p>Hi</p><script>alert(1)</script>', '<p>Hi</p>'],
    ['event handlers', '<p onclick="alert(1)">Hi</p>', '<p>Hi</p>'],
    ['inline styles and classes', '<p style="color:red" class="x" id="y">Hi</p>', '<p>Hi</p>'],
    ['links, keeping their text', '<p><a href="javascript:alert(1)">tap</a></p>', '<p>tap</p>'],
    ['images', '<p>a<img src=x onerror="alert(1)">b</p>', '<p>ab</p>'],
    ['iframes', '<iframe src="https://evil.example"></iframe><p>ok</p>', '<p>ok</p>'],
    ['svg payloads', '<svg><script>alert(1)</script></svg><p>ok</p>', '<p>ok</p>'],
    ['style sheets', '<style>body{display:none}</style><p>ok</p>', '<p>ok</p>'],
    ['data and aria attributes', '<p data-x="1" aria-label="y">ok</p>', '<p>ok</p>'],
    ['forms', '<form action="/x"><input name="q"><button>Go</button></form>', 'Go'],
    ['unlisted headings', '<h1>Big</h1><h2>Less</h2>', 'BigLess'],
    ['comments', '<p>a<!-- <script>x</script> -->b</p>', '<p>ab</p>'],
  ])('removes %s', (_, dirty, clean) => {
    expect(sanitizeDescription(dirty)).toBe(clean);
  });

  it('survives broken and nested markup', () => {
    const out = sanitizeDescription('<p><scr<script>ipt>alert(1)</script></p><b><p>x');
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toMatch(/on\w+=/i);
  });

  it('leaves plain text as text, escaped', () => {
    expect(sanitizeDescription('5 < 6 & "quoted"')).toBe('5 &lt; 6 &amp; "quoted"');
  });
});

describe('descriptionText', () => {
  it('separates blocks with spaces and decodes entities', () => {
    expect(
      descriptionText('<p>Soft &amp; light.</p><ul><li>Long-wear</li><li>Vegan</li></ul>'),
    ).toBe('Soft & light. Long-wear Vegan');
  });

  it('never returns markup or script text', () => {
    expect(descriptionText('<p>Hi<script>alert(1)</script><img onerror=x src=y></p>')).toBe('Hi');
  });
});

describe('excerpt', () => {
  it('keeps short text as it is', () => {
    expect(excerpt('Short text.')).toBe('Short text.');
  });

  it('cuts long text at a word, within the limit, with an ellipsis', () => {
    const text = 'word '.repeat(60).trim();
    const out = excerpt(text, 160);
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith('word…')).toBe(true);
  });

  it('cuts a single long word rather than returning nothing', () => {
    expect(excerpt('x'.repeat(300), 20)).toBe(`${'x'.repeat(19)}…`);
  });
});

import type { Product } from '@hb/types';
import { cn } from '@hb/ui';
import type { ReactNode } from 'react';
import { sanitizeDescription } from '@/lib/sanitize';

/**
 * Measure for running text: about 70 characters of 16 px Inter (04 §3, line length 60–75). `ch` is
 * the width of a "0", wider than an average letter, so 68ch gave 90-character lines.
 */
const MEASURE = 'max-w-[35rem]';

// Formatting for the sanitized description (only the tags the sanitizer keeps can appear).
const RICH_TEXT = cn(
  'text-ink-900 [&>*+*]:mt-4',
  '[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_li+li]:mt-1.5 [&_li]:marker:text-gold-600',
  '[&_h3]:font-display [&_h3]:text-xl [&_h4]:font-sans [&_h4]:text-base [&_h4]:font-semibold',
  '[&_blockquote]:border-l-2 [&_blockquote]:border-gold-500 [&_blockquote]:pl-4 [&_blockquote]:text-ink-500',
);

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      {/* The H2 of 04 §3 (40 / 28), as the page's other section headings. */}
      <h2
        id={id}
        className="mb-4 font-display text-[28px] font-medium leading-tight text-ink-900 md:text-[40px]"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Description · How to use · Ingredients (docs/p5-catalog.md §5 "Details"): stacked sections, a
 * missing one is left out. The description is seller-written HTML, sanitized here on the server
 * (lib/sanitize.ts); the other two are plain text.
 */
export function ProductDetails({ product, className }: { product: Product; className?: string }) {
  const description = product.descriptionHtml.trim()
    ? sanitizeDescription(product.descriptionHtml)
    : '';
  const howToUse = product.howToUse?.trim();
  const ingredients = product.ingredients?.trim();
  if (!description && !howToUse && !ingredients) return null;

  return (
    <div
      className={cn('grid gap-12 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:gap-12', className)}
    >
      {description ? (
        <Section id="description-title" title="Description">
          <div
            className={cn(RICH_TEXT, MEASURE)}
            // Sanitized: allowed tags only, no attributes (docs/p5-catalog.md §7).
            dangerouslySetInnerHTML={{ __html: description }}
          />
        </Section>
      ) : (
        <div aria-hidden className="hidden md:block" />
      )}
      {howToUse || ingredients ? (
        <div className="flex flex-col gap-12">
          {howToUse ? (
            <Section id="how-to-use-title" title="How to use">
              <p className={cn('whitespace-pre-line text-ink-900', MEASURE)}>{howToUse}</p>
            </Section>
          ) : null}
          {ingredients ? (
            <Section id="ingredients-title" title="Ingredients">
              {/* About 70 characters of 14 px text a line, like the 16 px text above. */}
              <p className="max-w-[30rem] text-sm leading-relaxed text-ink-500">{ingredients}</p>
            </Section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

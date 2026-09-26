import { cn } from '../lib/cn';

type LogoProps = {
  className?: string;
  /** 'full' = round seal + wordmark; 'seal' = round seal only; 'monogram' = HB only (< 64px, 04-ui-ux §11). */
  variant?: 'full' | 'seal' | 'monogram';
  /** On pink/dark backgrounds use the white + gold version (04-ui-ux §11). */
  inverted?: boolean;
  title?: string;
};

/*
 * TODO [CONFIRM]: placeholder mark built from the brief. Replace with the client's SVG
 * (docs/assets/hb-logo.jpg is a JPEG; 04-ui-ux §11 asks for SVG + transparent PNG).
 * The ring path has pathLength=1 so the hero can "draw" it with stroke-dashoffset.
 */
export function Logo({
  className,
  variant = 'full',
  inverted = false,
  title = 'Her Beauty',
}: LogoProps) {
  const letters = inverted ? 'fill-white' : 'fill-pink-700';
  const seal = (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label={title}
      className={cn('h-full w-auto shrink-0', variant === 'full' && 'h-10 md:h-11')}
    >
      {variant !== 'monogram' && (
        <>
          <circle
            data-draw="ring-outer"
            cx="50"
            cy="50"
            r="47"
            pathLength={1}
            className="fill-none stroke-gold-500"
            strokeWidth="1.5"
          />
          <circle
            data-draw="ring-inner"
            cx="50"
            cy="50"
            r="41"
            pathLength={1}
            className={cn('fill-none', inverted ? 'stroke-white/40' : 'stroke-pink-200')}
            strokeWidth="5"
          />
          <circle
            cx="50"
            cy="50"
            r="37"
            pathLength={1}
            className="fill-none stroke-gold-500"
            strokeWidth="0.75"
          />
        </>
      )}
      <text
        x="50"
        y="52"
        textAnchor="middle"
        dominantBaseline="middle"
        className={cn('font-display', letters)}
        fontSize="34"
        fontWeight="600"
        letterSpacing="-1"
      >
        HB
      </text>
    </svg>
  );

  if (variant !== 'full') return <span className={cn('inline-flex', className)}>{seal}</span>;

  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      {seal}
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            'font-display text-xl font-semibold tracking-tight md:text-2xl',
            inverted ? 'text-white' : 'text-ink-900',
          )}
        >
          Her Beauty
        </span>
        <span
          className={cn('eyebrow mt-1 !text-[10px]', inverted ? 'text-gold-300' : 'text-gold-800')}
        >
          Beauty marketplace
        </span>
      </span>
    </span>
  );
}

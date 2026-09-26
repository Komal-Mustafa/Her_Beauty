import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

/** 04-ui-ux §4: max width 1280 content / 1440 hero; gutters 16 mobile, 24 desktop. */
export function Container({
  className,
  wide = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { wide?: boolean }) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 md:px-6',
        wide ? 'max-w-[1440px]' : 'max-w-[1280px]',
        className,
      )}
      {...props}
    />
  );
}

type SectionHeadingProps = {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  as?: ElementType;
  align?: 'left' | 'center';
  className?: string;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  as: Tag = 'h2',
  align = 'left',
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        'mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between',
        align === 'center' && 'items-center text-center md:flex-col md:items-center',
        className,
      )}
    >
      <div className={cn('max-w-2xl', align === 'center' && 'mx-auto')}>
        {eyebrow && <p className="eyebrow mb-2 text-gold-800">{eyebrow}</p>}
        <Tag className="font-display text-[28px] font-medium leading-tight text-ink-900 md:text-[40px]">
          {title}
        </Tag>
        {description && <p className="mt-3 text-ink-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Thin gold divider with a centred diamond flourish (footer, section breaks). */
export function GoldDivider({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('flex items-center gap-3', className)}>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold-500" />
      <span className="h-2 w-2 rotate-45 border border-gold-500" />
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold-500" />
    </div>
  );
}

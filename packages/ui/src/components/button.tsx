import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

// 04-ui-ux §5: primary pink-600 (white text 5.9:1), gold uses dark text (never white).
// Reduced motion (04 §7): no lift or press scale, only colour and shadow change.
export const buttonVariants = cva(
  'relative inline-flex select-none items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-btn font-sans text-[15px] font-medium transition duration-fast ease-soft active:scale-[0.98] motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-pink-600 text-white shadow-soft hover:-translate-y-0.5 hover:bg-pink-700 hover:shadow-lift motion-reduce:hover:translate-y-0',
        // The shine is a pseudo-element so it also sweeps when the button renders a link
        // (asChild). Its rest offset is a `transform`, the property the shimmer keyframes animate,
        // so the sweep runs from -120% to 120% and ends off the button.
        gold: 'bg-grad-gold text-ink-900 shadow-soft hover:-translate-y-0.5 hover:shadow-lift motion-reduce:hover:translate-y-0 after:pointer-events-none after:absolute after:inset-0 after:bg-shine after:[transform:translateX(-120%)] hover:after:animate-shimmer',
        secondary: 'border border-pink-600 bg-white text-pink-600 hover:bg-pink-100',
        ghost: 'bg-transparent text-ink-900 underline-offset-4 hover:underline',
        quiet: 'bg-transparent text-ink-900 hover:bg-blush-50',
      },
      size: {
        sm: 'h-9 px-4 text-sm',
        md: 'h-12 px-6',
        lg: 'h-14 px-8 text-base',
        icon: 'h-11 w-11 p-0',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render as the child element (e.g. a Next.js Link) while keeping button styles. */
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, asChild = false, children, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp ref={ref} className={cn(buttonVariants({ variant, size, block }), className)} {...props}>
      {children}
    </Comp>
  );
});

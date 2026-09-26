'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { DURATION, EASE_SOFT, STAGGER } from '../motion';

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Position in a staggered group (0-based). */
  index?: number;
  as?: 'div' | 'li' | 'section';
};

/**
 * Scroll reveal: soft fade + 16px rise, once, when 20% visible.
 * Reduced motion → opacity only (04-ui-ux §7).
 */
export function Reveal({ children, className, index = 0, as = 'div' }: RevealProps) {
  const reduce = useReducedMotion();
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y: reduce ? 0 : 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: DURATION.slow * 1.4, ease: EASE_SOFT, delay: index * STAGGER }}
    >
      {children}
    </Comp>
  );
}

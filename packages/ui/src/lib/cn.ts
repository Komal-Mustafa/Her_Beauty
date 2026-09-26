import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Teach tailwind-merge our custom token names so it de-duplicates them correctly.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ['btn', 'card', 'pill'],
      shadow: ['soft', 'lift', 'gold'],
      ease: ['soft'],
    },
    classGroups: {
      'bg-image': ['bg-grad-pink', 'bg-grad-gold', 'bg-grad-rose', 'bg-shine'],
      duration: ['duration-fast', 'duration-base', 'duration-slow', 'duration-cinema'],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

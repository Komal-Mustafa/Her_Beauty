import { Cormorant_Garamond, Inter, Playfair_Display } from 'next/font/google';

// 04-ui-ux §3. Weights limited to what the type scale uses.
export const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-playfair',
  display: 'swap',
});

export const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['600'],
  variable: '--font-cormorant',
  display: 'swap',
});

export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const fontVariables = `${playfair.variable} ${cormorant.variable} ${inter.variable}`;

import localFont from 'next/font/local';

/*
 * 04-ui-ux §3 fonts, self-hosted from packages/config/fonts (OFL-1.1, latin subset).
 * Local files keep builds offline-safe (CI can't always reach Google Fonts) and let the
 * CSP keep font-src 'self'.
 */
export const playfair = localFont({
  src: [
    {
      path: '../../../packages/config/fonts/playfair-display-latin-500-normal.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../../../packages/config/fonts/playfair-display-latin-600-normal.woff2',
      weight: '600',
      style: 'normal',
    },
  ],
  variable: '--font-playfair',
  display: 'swap',
  fallback: ['Georgia', 'serif'],
});

export const cormorant = localFont({
  src: [
    {
      path: '../../../packages/config/fonts/cormorant-garamond-latin-600-normal.woff2',
      weight: '600',
      style: 'normal',
    },
  ],
  variable: '--font-cormorant',
  display: 'swap',
  fallback: ['Georgia', 'serif'],
});

export const inter = localFont({
  src: [
    {
      path: '../../../packages/config/fonts/inter-latin-wght-normal.woff2',
      weight: '100 900',
      style: 'normal',
    },
  ],
  variable: '--font-inter',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
});

export const fontVariables = `${playfair.variable} ${cormorant.variable} ${inter.variable}`;

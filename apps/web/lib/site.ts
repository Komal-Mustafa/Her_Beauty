export const SITE = {
  name: 'Her Beauty',
  shortName: 'HB',
  tagline: 'Her Beauty, Her Story',
  description:
    'Pakistan’s premium beauty marketplace. Genuine products from verified sellers and official brands, with payment protected until delivery.',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  sellerUrl: process.env.NEXT_PUBLIC_SELLER_URL ?? 'http://localhost:3001',
} as const;

import type { NavGroup, NavLink } from '@hb/types';
import { SITE } from './site';

/*
 * Every link here must resolve to a real page by the end of P5 (docs/frontend-plan.md). P5a built
 * the catalogue (/new, /offers, /brands, /category/*, /brand/*, /store/*, /search). Routes that
 * land later: /account/orders, /account/wishlist, /about, /faq, /contact, /policies/* and
 * /become-a-seller (P5b), /cart (P6), /advertise (P9).
 */
export const PRIMARY_NAV: NavLink[] = [
  { label: 'New in', href: '/new' },
  { label: 'Brands', href: '/brands' },
  { label: 'Offers', href: '/offers' },
  { label: 'Advertise', href: '/advertise' },
];

export const FOOTER_NAV: NavGroup[] = [
  {
    title: 'Shop',
    links: [
      { label: 'Lips', href: '/category/lips' },
      { label: 'Face', href: '/category/face' },
      { label: 'Skincare', href: '/category/skincare' },
      { label: 'Fragrance', href: '/category/fragrance' },
      { label: 'All brands', href: '/brands' },
      { label: 'Offers', href: '/offers' },
    ],
  },
  {
    title: 'Sell with us',
    links: [
      { label: 'Become a seller', href: '/become-a-seller' },
      { label: 'Advertise your brand', href: '/advertise' },
      { label: 'Seller login', href: `${SITE.sellerUrl}/login` },
      { label: 'Plans & pricing', href: '/become-a-seller#plans' },
    ],
  },
  {
    title: 'Help',
    links: [
      { label: 'Track an order', href: '/account/orders' },
      { label: 'Shipping & delivery', href: '/policies/shipping' },
      { label: 'Returns & refunds', href: '/policies/refund' },
      { label: 'FAQ', href: '/faq' },
      { label: 'Contact us', href: '/contact' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Her Beauty', href: '/about' },
      { label: 'Terms of service', href: '/policies/terms' },
      { label: 'Privacy policy', href: '/policies/privacy' },
    ],
  },
];

export const PAYMENT_METHODS = [
  'Visa',
  'Mastercard',
  'JazzCash',
  'Easypaisa',
  'Raast',
  'Cash on delivery',
] as const;

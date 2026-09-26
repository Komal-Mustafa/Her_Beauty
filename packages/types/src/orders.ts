import { z } from 'zod';

// Matches seller_order_status enum in docs/05-database-schema.md and the state machine in 02-trd §6.1.
export const SellerOrderStatus = z.enum([
  'awaiting_payment',
  'cod_pending',
  'paid',
  'accepted',
  'shipped',
  'in_transit',
  'delivered',
  'released',
  'return_requested',
  'returned',
  'refunded',
  'disputed',
  'cancelled',
]);
export type SellerOrderStatus = z.infer<typeof SellerOrderStatus>;

export const PaymentMethod = z.enum([
  'card',
  'jazzcash',
  'easypaisa',
  'bank_transfer',
  'raast',
  'cod',
]);
export type PaymentMethod = z.infer<typeof PaymentMethod>;

/** Customer-facing tracker steps (04-ui-ux §5): Paid → Accepted → Shipped → In transit → Delivered. */
export const TRACKER_STEPS = ['paid', 'accepted', 'shipped', 'in_transit', 'delivered'] as const;
export type TrackerStep = (typeof TRACKER_STEPS)[number];

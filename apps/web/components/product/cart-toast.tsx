import type { useToast } from '@hb/ui';
import Link from 'next/link';
import { MAX_LINES, MAX_QTY, type AddToCartResult } from '@/lib/cart-store';

type ToastInput = Parameters<ReturnType<typeof useToast>['show']>[0];

const viewCart = <Link href="/cart">View cart</Link>;

/** Why no more of an item fits: the per-order limit, or the stock when that is lower. */
export function itemLimitText(stock = MAX_QTY): string {
  return stock < MAX_QTY
    ? `Only ${stock} left in stock.`
    : `You can buy up to ${MAX_QTY} of one item per order.`;
}

type CartToastOptions = {
  /** What the shopper can do if the item could not be added. */
  whenInvalid?: string;
  /** The variant's stock, when known: `max-qty` then names the lower of it and the limit. */
  stock?: number;
};

/**
 * The toast after an add to cart (docs/p4-home.md §4), shared by the product cards and the
 * product page. `body` names what was added ("Silk Lip Oil", "2 × Velvet Matte Lipstick, …").
 */
export function cartToast(
  result: AddToCartResult,
  body: string,
  { whenInvalid = 'Open the product page to add it from there.', stock }: CartToastOptions = {},
): ToastInput {
  switch (result) {
    case 'added':
      return { tone: 'success', title: 'Added to cart', body, action: viewCart };
    case 'max-qty':
      return {
        tone: 'info',
        title: 'Already in your cart',
        body: itemLimitText(stock),
        action: viewCart,
      };
    case 'full':
      return {
        tone: 'info',
        title: 'Your cart is full',
        body: `A cart holds up to ${MAX_LINES} different items.`,
        action: viewCart,
      };
    default:
      return { tone: 'warning', title: 'We couldn’t add this item', body: whenInvalid };
  }
}

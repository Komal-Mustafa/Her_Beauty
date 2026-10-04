import type { useToast } from '@hb/ui';
import Link from 'next/link';
import { MAX_LINES, MAX_QTY, type AddToCartResult } from '@/lib/cart-store';

type ToastInput = Parameters<ReturnType<typeof useToast>['show']>[0];

const viewCart = <Link href="/cart">View cart</Link>;

/**
 * The toast after an add to cart (docs/p4-home.md §4), shared by the product cards and the
 * product page. `whenInvalid` says what the shopper can do if the item could not be added.
 */
export function cartToast(
  result: AddToCartResult,
  title: string,
  whenInvalid = 'Open the product page to add it from there.',
): ToastInput {
  switch (result) {
    case 'added':
      return { tone: 'success', title: 'Added to cart', body: title, action: viewCart };
    case 'max-qty':
      return {
        tone: 'info',
        title: 'Already in your cart',
        body: `You can buy up to ${MAX_QTY} of one item per order.`,
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

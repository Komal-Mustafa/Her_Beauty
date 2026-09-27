'use client';

import type { ProductCard as ProductCardData } from '@hb/types';
import { ProductCard, useToast, type ProductCardImageProps } from '@hb/ui';
import Image from 'next/image';
import Link from 'next/link';
import { addToCart, MAX_LINES, MAX_QTY } from '@/lib/cart-store';
import { toggleWishlist, useIsWishlisted } from '@/lib/wishlist-store';

type ShopProductCardProps = {
  product: ProductCardData;
  /** Only for the first cards of a page that sit above the fold. */
  priority?: boolean;
  sizes?: string;
  headingLevel?: 'h2' | 'h3' | 'h4';
  className?: string;
};

function CardImage({ src, alt, sizes, className, priority }: ProductCardImageProps) {
  return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={className} />;
}

const viewCart = <Link href="/cart">View cart</Link>;

/** `ProductCard` wired to the client cart, the wishlist and the toast (docs/p4-home.md §4). */
export function ShopProductCard({ product, ...props }: ShopProductCardProps) {
  const toast = useToast();
  const wishlisted = useIsWishlisted(product.id);

  function onAddToCart(p: ProductCardData) {
    const [image] = p.images;
    if (!p.quickAddVariantId || !image) return;
    const result = addToCart({
      variantId: p.quickAddVariantId,
      productSlug: p.slug,
      title: p.title,
      image: image.url,
      unitPrice: p.price,
    });
    if (result === 'added') {
      toast.show({ tone: 'success', title: 'Added to cart', body: p.title, action: viewCart });
    } else if (result === 'max-qty') {
      toast.show({
        tone: 'info',
        title: 'Already in your cart',
        body: `You can buy up to ${MAX_QTY} of one item per order.`,
        action: viewCart,
      });
    } else if (result === 'full') {
      toast.show({
        tone: 'info',
        title: 'Your cart is full',
        body: `A cart holds up to ${MAX_LINES} different items.`,
        action: viewCart,
      });
    } else {
      toast.show({
        tone: 'warning',
        title: 'We couldn’t add this item',
        body: 'Open the product page to add it from there.',
      });
    }
  }

  return (
    <ProductCard
      product={product}
      linkAs={Link}
      imageAs={CardImage}
      wishlisted={wishlisted}
      onToggleWishlist={(p) => toggleWishlist({ productId: p.id, productSlug: p.slug })}
      onAddToCart={onAddToCart}
      {...props}
    />
  );
}

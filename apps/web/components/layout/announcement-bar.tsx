import Link from 'next/link';

/** 04-ui-ux §6.1: pink-600 bar, white text. */
export function AnnouncementBar() {
  return (
    <div className="bg-pink-600 text-white">
      <p className="mx-auto max-w-[1280px] px-4 py-2 text-center text-xs sm:text-sm">
        <span className="hidden sm:inline">Payment protected until delivery · </span>
        <Link href="/policies/shipping" className="underline underline-offset-2 hover:no-underline">
          Free delivery over Rs 3,000 from selected sellers
        </Link>
      </p>
    </div>
  );
}
